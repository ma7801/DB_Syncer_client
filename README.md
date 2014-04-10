<strong>DB_Syncer_Client</strong> is a PhoneGap-based API that allows a database on a PhoneGap device to be synced with a remote server.

API Reference:

Constructor: DB_Syncer(error_callback, success_callback) :

Creates a DB_Syncer object, Creates The 'error_callback' indicates the function that will be called if
the creation of the object, local database

initialize_server_db() : 

 


NOTE: You must install the cordova plugin org.apache.cordova.network-information before doing a cordova
build, despite PhoneGap's instructions.  I.e.:

cordova plugin add org.apache.cordova.network-information
cordova build  #WARNING: this will wipe out the www directory and replace it with a fresh dir structure
               # and files.  Backup all necessary files first, and then copy back afterwards.