<h1> DB_Syncer_client </h1>

<strong>DB_Syncer_Client</strong> is a Phonegap-based API that allows a database within a PhoneGap mobile app to be synced with a remote server.  It is intended to be a simple solution to database syncing, and to put as little responsibility on the developer to worry about the details of database synchronization.  DB_Syncer_Client must be used with DB_Syncer_Server (to be installed on the server, of course), which uses MySQL (PHP mysqli) to access the server database. 

<strong>NOTE: This README is in beta :)!</strong>

<h2>Setup</h2>

Configuration settings are located in the "dbsconfig.js" file.  Set these values accordingly (database name, remote server URL, etc.)

<h2>API Reference:</h2>


(Constructor) 
`DB_Syncer([success_callback], [error_callback])`

Creates a DB_Syncer object,  The 'error_callback' indicates the function that will be called if there is an error during object creation. 'success_callback' is the function that will be called if everything goes swimmingly. See below for arguments of 'error_callback'; 'success_callback' is passed no arguments.

`DB_Syncer.initialize_client_db([success_callback], [error_callback])`
Creates a table in the local database called "_dbs_sync_actions" which will maintain sync information, sets some triggers up in the tables that are to be synced (set in dbsconfig.js). This must be called before any data (that is to be synced) is added to the database.  DB_Syncer_Client and DB_Syncer_Server currently do not support syncing pre-existing data. Must be called before calling DB_Syncer.sync();


`DB_Syncer.initialize_server_db([success_callback], [error_callback])`

Initializes that server database. DB_Syncer_Server must be installed on server. Calls remote function on server (at the URL located in dbsconfig.js) to create the database if it doesn't exist (i.e. __server_db_name in dbsconfig.js). Creates a table "_dbs_sync_actions" on server database which will maintain sync information, and sets some triggers up in the tables on the remote database. See below for arguments of 'error_callback'; 'success_callback' is passed no arguments.

`DB_Syncer.sync([success_callback], [error_callback])`

Actually syncs the local and remote databases. 'error_callback' is the function called on error, 'success_callback' is the function called on success. See below for arguments of 'error_callback'; 'success_callback' is passed the following arguments:
`success_callback(number_of_clients_records_synced, number_of_server_records_synced)`

<strong>NOTE:</strong>
All 'error_callback' functions have the following arguments passed to them:
`error_callback(err_code, err_message)`


<h2>Usage Example</h2>
```javascript
my_dbs = new DB_Syncer();
my_dbs.initialize_client_db();
my_dbs.initialize_server_db();

/* Code to do stuff in the database, insert, update, delete, etc. 
...
...
...
*/

my_dbs.sync(
    function(client_recs,server_recs) {
        // Successfully synced the databases
        console.log("Successfully synced " + client_recs + 
                    " client records and " + server_recs " server records!");

    }
    function() {
        // Error on sync
    }
    
);
```


<h2>Miscellaneous Notes</h2> 

NOTE: You must install the cordova plugin org.apache.cordova.network-information before doing a cordova
build, despite PhoneGap's instructions.  I.e.:

cordova plugin add org.apache.cordova.network-information
cordova build 

<strong>WARNING</strong>: this will wipe out the www directory and replace it with a fresh dir structure
and files.  Backup all necessary files first, and then copy back afterwards.
