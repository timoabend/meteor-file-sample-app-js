// Create a file collection, and enable file upload and download using HTTP
myData = new FileCollection('myData',
                            { resumable: true,   // Enable built-in resumable.js upload support
                             http: [
                                 { method: 'get',
                                  path: '/:md5',  // this will be at route "/gridfs/myFiles/:md5"
                                  lookup: function (params, query) {  // uses express style url params
                                      return { md5: params.md5 };       // a query mapping url to myFiles
                                  }
                                 }
                             ]
                            }
                           );

if (Meteor.isServer) {
    Accounts.config({sendVerificationEmail: true, forbidClientAccountCreation: false});

    // Only publish files owned by this userId, and ignore
    // file chunks being used by Resumable.js for current uploads
    Meteor.publish('myData',
                   function (clientUserId) {
                       if (clientUserId === this.userId) {
                           return myData.find({ 'metadata._Resumable': { $exists: false },
                                               'metadata.owner': this.userId });
                       } else {        // Prevent client race condition:
                           return null;  // This is triggered when publish is rerun with a new
                           // userId before client has resubscribed with that userId
                       }
                   }
                  );

    // Allow rules for security. Should look familiar!
    // Without these, no file writes would be allowed
    myData.allow({
        // The creator of a file owns it. UserId may be null.
        insert: function (userId, file) {
            // Assign the proper owner when a file is created
            file.metadata = file.metadata || {};
            file.metadata.owner = userId;
            return true;
        },
        // Only owners can remove a file
        remove: function (userId, file) {
            // Only owners can delete
            return (userId === file.metadata.owner);
        },
        // Only owners can retrieve a file via HTTP GET
        read: function (userId, file) {
            return (userId === file.metadata.owner);
        },
        // This rule secures the HTTP REST interfaces' PUT/POST
        // Necessary to support Resumable.js
        write: function (userId, file, fields) {
            // Only owners can upload file data
            return (userId === file.metadata.owner);
        }
    });
}

if (Meteor.isClient) {

    Meteor.startup(function() {

        // This assigns a file upload drop zone to some DOM node
        myData.resumable.assignDrop($(".fileDrop"));

        // This assigns a browse action to a DOM node
        myData.resumable.assignBrowse($(".fileBrowse"));

        // When a file is added via drag and drop
        myData.resumable.on('fileAdded', function (file) {

            // Create a new file in the file collection to upload
            myData.insert({
                _id: file.uniqueIdentifier,  // This is the ID resumable will use
                filename: file.fileName,
                contentType: file.file.type
            },
                          function (err, _id) {  // Callback to .insert
                              if (err) { return console.error("File creation failed!", err); }
                              // Once the file exists on the server, start uploading
                              myData.resumable.upload();
                          }
                         );
        });

        // This autorun keeps a cookie up-to-date with the Meteor Auth token
        // of the logged-in user. This is needed so that the read/write allow
        // rules on the server can verify the userId of each HTTP request.
        Deps.autorun(function () {
            // Sending userId prevents a race condition
            Meteor.subscribe('myData', Meteor.userId());
            // $.cookie() assumes use of "jquery-cookie" Atmosphere package.
            // You can use any other cookie package you may prefer...
            $.cookie('X-Auth-Token', Accounts._storedLoginToken());
        });

    });

    shorten = function(name, w) {
        if (w == null) {
            w = 16;
        }
        if (w % 2) {
            w++;
        }
        w = (w - 2) / 2;
        if (name.length > w) {
            return name.slice(0, +w + 1 || 9e9) + '...' + name.slice(-w - 1);
        } else {
            return name;
        }
    };
    Template.collTest.events({
        'click .del-file': function(e, t) {
            return myData.remove({
                _id: this._id
            });
        }
    });
    Template.collTest.dataEntries = function() {
        return myData.find({});
    };
    Template.collTest.shortFilename = function(w) {
        if (w == null) {
            w = 16;
        }
        return shorten(this.filename, w);
    };
    Template.collTest.owner = function() {
        var _ref, _ref1;
        return (_ref = this.metadata) != null ? (_ref1 = _ref._auth) != null ? _ref1.owner : void 0 : void 0;
    };
    Template.collTest.id = function() {
        return "" + this._id;
    };
    Template.collTest.link = function() {
        return myData.baseURL + "/" + this.md5;
    };
    Template.collTest.uploadStatus = function() {
        var percent;
        percent = Session.get("" + this._id);
        if (percent == null) {
            return "Processing...";
        } else {
            return "Uploading...";
        }
    };
    Template.collTest.formattedLength = function() {
        return numeral(this.length).format('0.0b');
    };
    Template.collTest.uploadProgress = function() {
        var percent;
        return percent = Session.get("" + this._id);
    };
    Template.collTest.isImage = function() {
        var types;
        types = {
            'image/jpeg': true,
            'image/png': true,
            'image/gif': true,
            'image/tiff': true
        };
        return types[this.contentType] != null;
    };
    Template.collTest.loginToken = function() {
        Meteor.userId();
        return Accounts._storedLoginToken();
    };
    Template.collTest.userId = function() {
        return Meteor.userId();
    };
}