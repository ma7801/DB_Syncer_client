/************************************************
/* DB_Syncer.js
/*
/* Prototype of DB_Syncer for PhoneGap apps
 * 
 * @author: Mike Anders
 * 
 *
 * 
 *   
 *   
 */
/*******************************************************************************
 * /
 ******************************************************************************/

// Global settings

/*
 * If you want database deletes to be 'logical' (i.e. a field is set to true if
 * a record is deleted) set the following to true and indicate the name for your
 * logical delete field in all of your tables.
 * 
 */
var logical_deletes = true;  // Non-logical deletes not implemented yet
var delete_field = "_is_deleted";

//Some constants:
var DBS_ERROR_NO_NETWORK = 1;



// DB_Syncer constructor

function DB_Syncer(success_callback, error_callback) {
    
	try {
		// All of these variables to which the object properties are assigned are defined in dbsconfig.js
		this.local_db_name = __local_db_name;
		this.db_readable_name = __db_readable_name;
	    this.db_ver = __db_ver;
	    this.db_size = __db_size;
	    this.server_URL = __server_URL;
	    this.server_db_name = __server_db_name;
	    this.id_col = __id_col_name;
	    this.tables_to_sync = $.extend(true,[],__tables_to_sync); // Performs deep copy
	}
	catch(e) {
		if(arguments.length > 1) { error_callback(e.message); }
	}
	if(arguments.length > 0) { success_callback(); }
	    
   
}


// DB_Syncer prototype

DB_Syncer.prototype = {
    constructor: DB_Syncer,
    
    // 'PUBLIC' methods:
    
    // Getters:
    is_ready: function() {
    	return this.ready;
    },
    initialize_client_db: function(success_callback, error_callback) {
    	var db = window.openDatabase(this.local_db_name, this.db_ver, this.db_readable_name, this.db_size);
        self = this;
        
        db.transaction(
        	function(tx) {
        		// Create the _dbs_sync_actions table
        	    var sql = "CREATE TABLE IF NOT EXISTS _dbs_sync_actions (" +
    	                    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    	                    "table_name VARCHAR(20), " +
    	                    "record_id INTEGER, " +
    	                    "sync_action VARCHAR(20), " +
    	                    "timestamp TEXT)";
    	        
    	        tx.executeSql(sql, [], function() {
    	        	console.log("Success: created _dbs_sync_actions table");
    	        }, function (tx, err) {
    	        	error_callback("Error creating _dbs_sync_actions table: " + err.message);
    	        });

    	        // Create the _dbs_vars table
    	        sql = "CREATE TABLE IF NOT EXISTS _dbs_vars (" +
    	        		"id INTEGER PRIMARY KEY AUTOINCREMENT, " + 
    	        		"db_locked BOOLEAN DEFAULT 0, " +
    	        		"triggers_created BOOLEAN DEFAULT 0)";
    	        
    	        tx.executeSql(sql, [], function() {
    	        	console.log("Successfully created _dbs_vars (or it already existed)");
    	        	
    	        	// Create a record on _dbs_vars if it doesn't have a record yet
    	        	sql = "INSERT INTO _dbs_vars (id, db_locked, triggers_created) VALUES (?, ?,?)";
    	        	
    	        	
    	        	// The below calls set_triggers no matter what, but passes an
    				// error code of 0 if no error
    	        	tx.executeSql(sql, [1, 0,0], function() {
    	        		var error = {"code":0};
    	        		
    	        		set_triggers(error);
    	        	}, function(tx, error) {
    	        		set_triggers(error);
    	        	});
    	        	
    	        	var set_triggers = function(err) {
    	        		
    	        		// If we have an unexpected error, i.e. anything other than
    					// no error or primary key
    	        		// error
    	        		if(!(err.code === 0 || err.code === 1)) {
    	        			console.log("Error in inserting values into _dbs_vars: (" + err.code + "):" + err.message);
    	        			error_callback("Error in inserting values into _dbs_vars: (" + err.code + "):" + err.message);
    	        			return;
    	        		}
    	        		
    	        		// Create triggers on all of the tables in the database 
    		        	
    		        	// First, see if the triggers are already created
    		        	sql = "SELECT triggers_created FROM _dbs_vars";
    		        	tx.executeSql(sql, [], function(tx, results) {
    		        		if (results.rows.item(0).triggers_created) {
    		        			// Triggers already created; skip the rest of the
    							// code within this callback
    		        			console.log("Triggers already created, skipping...");
    		        			return;
    		        		}
    		        	
    		        	   	// Create the triggers on each table for all actions
    				       	for (var cur = 0; cur < self.tables_to_sync.length; cur++) {
    				        	var table_name = self.tables_to_sync[cur];
    				        	// DEBUG:
    				        	console.log("Attempting to create triggers on table '" + table_name + "'...");
    				        	
    				        	// Insert trigger
    			        		sql = "CREATE TRIGGER IF NOT EXISTS insert_" + table_name + " AFTER INSERT ON " +
    			        			table_name + 
    			        			" BEGIN " +
    			        				" INSERT INTO _dbs_sync_actions (table_name, record_id, sync_action," +
    			        				"timestamp) VALUES ('" + table_name + 
    			        				"', NEW.id,'insert',datetime('now'));" +
    			        			"END;";
    			        		
    			        		console.log("trigger sql=" + sql);
    			        		tx.executeSql(sql, [], function () {
    			        			console.log("Successfully created insert trigger on table " + table_name);
    			        		}, function(tx, err) {
    			        			console.log("Error creating trigger on table " + table_name + ":" +
    			        					err.message);
    			        			error_callback("Error creating trigger on table " + table_name + ":" +
    			        					err.message);
    			        		});
    			        		
    			        		// Update trigger
    			        		sql = "CREATE TRIGGER IF NOT EXISTS update_" + table_name + " AFTER UPDATE ON " +
    			        				table_name +
    			        				" BEGIN " +
    			        				" INSERT INTO _dbs_sync_actions (table_name, record_id, sync_action," +
    			        				"timestamp) VALUES ('" + table_name + 
    			        				"', NEW.id,'update',datetime('now'));" +
    			        				"END;";
    			        		
    			        		tx.executeSql(sql, [], function () {
    			        			console.log("Successfully created update trigger on table " + table_name);
    			        			success_callback();
    			        		}, function(tx, err) {
    			        			console.log("Error creating trigger on table " + table_name + ":" +
    			        					err.message);
    			        			error_callback("Error creating trigger on table " + table_name + ":" +
    			        					err.message);
    			        		});
    			        		
    			        		// CODE WHERE ACTUAL DELETE TRIGGER WOULD GO IF IMPLEMENTED
    			        		/*  - when implementing, put call to success_callback in success callback of exectueSql below
    			        		tx.executeSql(sql, [], function () {
    			        			console.log("Successfully created delete trigger on table " + table_name);
    			        		}, function(tx, err) {
    			        			console.log("Error creating trigger on table " + table_name + ":" +
    			        					err.message);
    			        			error_callback("Error creating trigger on table " + table_name + ":" +
    			        					err.message);
    			        		});
    			        		*/
    			        		
    			        	}
    			        	
    			   
    	        		
    	        		}, function (tx, err) {
    	        		console.log("Error looking up triggers_created in _dbs_vars: " + err.message);
    	        		error_callback("Error looking up triggers_created in _dbs_vars: " + err.message);
    	        		});
            		}
    	        	
    	        }, function(tx, err) {
    	        	console.log("Error creating _dbs_vars table: " + err.message);
    	        	error_callback("Error creating _dbs_vars table: " + err.message);
    	        });
        	
    	        
    	        
    	       
        	
        	},  
        	function(err) {
        		console.log("open database error: " + err.message);
        		error_callback("open database error: " + err.message);
        	}, 
        	function() {
        		console.log("open database success!");

        	}
        
    	);
        	
    },
    initialize_server_db: function(success_callback, error_callback) {
    	// *** NEEDS TESTNG
    	// Creates and initializes the database on the server; only needs be called if 
    	// the database hasn't already been created on the server
    	
    	// First, get all the table names in this database, and their definitions
    	var db = window.openDatabase(this.local_db_name, this.db_ver, this.db_readable_name, this.size);
	    
    	// Register AJAX error handler
    	 $(document).ajaxError(function(e,j,as,error) {
         	console.log("AJAX error: " + error);
         });
    	
    	self = this;
    	db.transaction(function(tx) {
	    	sql = "SELECT * FROM sqlite_master WHERE type='table'";
	    	tx.executeSql(sql, [], function(tx, results) {
	    		var t_names = Array();
	    		var t_defs = Array();
	    		
	    		// Store the table names and definitions (sql statements)
	    		for(var cur = 0; cur < results.rows.length; cur++) {
	    			
	    			// Skip any _dbs info tables
	    			if(results.rows.item(cur).name.indexOf("_dbs") === 0) {
	    				continue;
	    			}
	    			
	    			// Skip if this is a sqlite table or webkit info database
	    			if(results.rows.item(cur).name.indexOf("__WebKit") === 0 || 
	    					results.rows.item(cur).name.indexOf("sqlite") === 0) {
	    				continue;
	    			}
	    			
	    			t_names.push(results.rows.item(cur).name);
	    			t_defs.push(results.rows.item(cur).sql);
	    		}
	    		
	    		// Send this info to the server
	    	    $.post(self.server_URL, {action:"initialize_db", remote_db:self.server_db_name, 
	    	    	table_names:t_names, table_defs:t_defs},
	    			   function (data) {
	    	    		
	    	       console.log("raw data received: " + data);
	    		   if (data.err === 0) {
	    			   console.log("Server database was successfully initialized.");
	    		   }
	    		   else {
	    			   console.log("Error in server database initializaion: " + data.error);
	    		   }
	    		   
	    		   
	    	   }, "text");
	    		
	    	}, function(tx, err) {
	    		console.log("Error in retrieving table data from sqlite_master: " + err.message);
	    	});
	    }, function(err) {
	    	console.log("Error in opening local database (in intialize_server_db): " + err.message);
	    });
    	
    	
    },
    sync: function(success_callback, error_callback) {
        // ACTUALLY SYNCS THE DATABASES
    	this.success_callback = success_callback;
    	this.error_callback = error_callback;
    	this.num_server_records = 0;
    	this.num_client_records = 0;
    	
    	//DEBUG:
    	console.log("connection:" + navigator.connection.type);
    	console.log("Connection.NONE=" + Connection.NONE);
       
        if (navigator.connection.type == Connection.NONE) {
            	error_callback(DBS_ERROR_NO_NETWORK);
        }
        
        self = this;
        
    	// First, reduce the sync table
    	this._reduce_sync_table(function(num_records) {
    		// See if there are no records in the sync table - in that case just
			// call the server to client sync
    		if(num_records === 0) {
    			console.log("Number of client records = 0");
    			self._server_to_client_sync();
    		}
    		// DEBUG:
    		else {
    			// Copy the reduced sync table to a temp table for debugging
				// purposes
    			var db = window.openDatabase(self.local_db_name, self.db_ver, self.db_readable_name, self.size);
		        db.transaction(function(tx) {
		        	var sql = "DROP TABLE IF EXISTS _dbs_last_sync_reduction";
		        	tx.executeSql(sql, [], function(tx) {
		        		sql = "CREATE TABLE IF NOT EXISTS _dbs_last_sync_reduction AS SELECT * FROM _dbs_sync_actions";
		        		tx.executeSql(sql, [], function() {
		        			self.success_handler("Created a copy of the reduced sync table.");
		        		}, function(tx, err) {
		        			self.error_handler("Error creating copy of the reduced sync table:" + err.message);
		        		});
		        	}, function(tx, err) {
		        		self.error_handler("Error dropping existing 'last_sync_reduction' table:" + err.message);
		        	});
		        });
    		}
    		
    		// END DEBUG
    		
    	
    	
	    	// DEBUG***
	    	// return;
	    	
	        var db = window.openDatabase(self.local_db_name, self.db_ver, self.db_readable_name, self.size);
	        db.transaction(function(tx) {
	            // Get the sync action records
	            var sql = "SELECT * FROM _dbs_sync_actions";
	            tx.executeSql(sql, [], function(tx, sync_actions_results) {
	                
	                var is_last_record = false;  
	                // For each record in the sync action table
	                for(cur_sync = 0; cur_sync < sync_actions_results.rows.length; cur_sync++) {
	                	// If this is the last record
	                	if(cur_sync === sync_actions_results.rows.length - 1) {
	                		is_last_record = true;
	                	}
	                	
	                	self._sync_record(sync_actions_results.rows.item(cur_sync).id, is_last_record);
	                }
	                           
	            }, 
	            function(tx, err) {
	            	self.error_handler("Could not select from _dbs_sync_actions table (sync): " + err.message);
	            });
	        },
	        function(err) {
	        	self.error_handler("Could not open database (sync): " + err.message);
	        },
	        function() {
	            self.success_handler("Opened the database (sync).");
	        
	        });
            
    	});
    },
    _reduce_sync_table: function(callback) {
    	
    	// @NEEDS TESTING
    	// Reduces the sync table to avoid exchanging unnecessary information
		// with the server
    	// This will reduce two (or more) records as follows:
    	// First action / Latest Action / Reduced Action
    	// Insert Update Insert with latest update data
    	// Insert Delete none / remove all actions
    	// Update Update Update with latest update data
    	// Update Delete Delete
    	
    	var db = window.openDatabase(this.local_db_name, this.db_ver, this.db_readable_name, this.size);
    	self = this;
    	
    	db.transaction(function(tx) {
    		// Get the entire sync_actions table, make sure the most recent
			// actions are last
    		sql = "SELECT * FROM _dbs_sync_actions ORDER BY table_name, record_id, date(timestamp)";
    		tx.executeSql(sql, [], function(tx, results) {
    			var older_indices = new Array();
    			var record_ids_processed = new Array();
    			var tables_processed = new Array();
    			
    			// Compare each of the ids of each record to that of the other
				// and see if there are any
    			// repeated ids (if so, handle the reduction
    			var latest_index;
    			for (var left = 0; left < results.rows.length; left++) {
    				delete older_indices;
    				older_indices = new Array();
    				
    				// Skip this record_id if it's already been processed
    				if(($.inArray(results.rows.item(left).record_id, record_ids_processed) !== -1) ||
    					$.inArray(results.rows.item(left).table_name, tables_processed) !== -1) {
    					continue;
    				}
    				
    				// Indicate that this record_id has been processed
    				record_ids_processed.push(results.rows.item(left).record_id);
   				
    				latest_index = -1;  // Indication that there is no duplicate
    				for (var right = left + 1; right < results.rows.length; right++) {
    					// DEBUG:
    					/*
						 * console.log("START"); console.log("left = " + left + ",
						 * right = " + right); console.log("left record_id = " +
						 * results.rows.item(left).record_id); console.log("left
						 * action = " + results.rows.item(left).sync_action);
						 * console.log("right record_id = " +
						 * results.rows.item(right).record_id);
						 * console.log("right action = " +
						 * results.rows.item(right).sync_action);
						 * console.log("END");
						 */
    					
    					// See if this is the last record of the current
						// table_name
        				if(results.rows.item(left).table_name !== results.rows.item(right).table_name) {
        				    // Indicate that every record in the current table
							// has processed; we need to do this
        			        // since we're reseting the record_ids_processed
							// array below, and we don't want any
        			        // other records in the current table_name processed
							// - we're done with it
        			        tables_processed.push(results.rows.item(left).table_name);
        			        
        			        // Reset the record_ids_processed array
        			        record_ids_processed.length = 0;
        			        
        			        // We're not going to find anymore matches; stop
							// looking
        			        break;
        				}
        				
        	    		// See if the record ids match (we already know the
						// table names do)
    					if (results.rows.item(left).record_id === results.rows.item(right).record_id) {
    						// The "left" record_id matches the "right"
							// record_id;
    						    						
    						// In case that this isn't the latest record, we
							// need to save a list of all
    						// previous "latest" indices. (i.e. if latest index
							// has been set)
    						if (latest_index >= 0) {
    							older_indices.push(latest_index);
        					}
    						
    						// save the index of this record as the "latest" (it
							// may not be the latest, but
    						// is a this point in the loop)
    						latest_index = right;
    					}
    					else {
    						// Since the record ids are in order, we're not
							// going to find it down
    						// any lower in the table, so stop looking
    						break;
    					}
    				}
    				
    				
    				// If there was more than one action for a record_id
    				if (latest_index >= 0) {
    					var oldest_index = left;  // For readability of code
													// only
        				
    					// DEBUG:
    					/*
						 * console.log("START of reduction");
						 * console.log("oldest record_id = " +
						 * results.rows.item(oldest_index).record_id);
						 * console.log("latest record_id (should be same) = " +
						 * results.rows.item(latest_index).record_id);
						 * console.log("oldest action = " +
						 * results.rows.item(oldest_index).sync_action);
						 * console.log("latest action = " +
						 * results.rows.item(latest_index).sync_action);
						 * console.log("END of reduction");
						 */
    					
    					// Is the older action an insert?
    					if (results.rows.item(oldest_index).sync_action === "insert") {
    						
    						// Situation 1: insert then update
    						if (results.rows.item(latest_index).sync_action === "update") {
    							// Remove the older sync records (oldest_index
								// and and the older_indices)
    							// First, put the oldest id on the stack of
								// older_indices
    							older_indices.push(oldest_index);
    							
    							// Remove all older records
    							for(var cur = 0; cur < older_indices.length; cur++) {
    								sql = "DELETE FROM _dbs_sync_actions WHERE id=?";
    								
    								tx.executeSql(sql, [results.rows.item(older_indices[cur]).id], function(tx, results) {
    									self.success_handler("Deleted older duplicate actions in _dbs_sync_actions table");
    								}, function(tx, err) {
    									self.error_handler("Error deleting duplicate in _dbs_sync_actions table.");
    								});
    							}
    							
								// Change the action of the latest "update"
								// record to "insert"
								sql = "UPDATE _dbs_sync_actions SET sync_action='insert' WHERE id=?";
								tx.executeSql(sql, [results.rows.item(latest_index).id], function(tx, results) {
									self.success_handler("Updated latest duplicate action in _dbs_sync_actions to insert.");
								}, function(tx, err) {
									self.error_handler("Error updating latest duplicate action in _dbs_sync_actions: " 
											+ err.message)
								});
	 						}
    						
    						// Situation 2: insert then delete
    						else if (results.rows.item(latest_index).sync_action === "delete") {
    							
    							// Remove all but the 2nd to last and last sync
								// record
    							// need to have record inserted on server and
								// then marked as deleted
    							// (reduces to two actions minimum)
    							// UPDATE:
    							// Now reduces to just one action - an insert;
								// the data record should already
    							// be marked as deleted on the client, so the
								// data, including the deleted flag
    							// will be sent to the server. A delete action
								// then need not be sent to the server.
    							// Basically takes second to last action for a
								// particular record_id and makes
    							// it an insert if it isn't already
    							
    							/*
								 * // First see if there are only two actions -
								 * the insert and the delete if
								 * (older_indices.length === 0) { continue; //
								 * Don't do anything - keep these two actions
								 * (can't be reduced) } else {
								 */
								if (older_indices.length === 0) {
									// 2nd to last index is the oldest index;
									// save this index
									second_to_last_index = oldest_index;
								}
								else {
									// 2nd to last index is the last one put in
									// the older_indices stack;
									// Save this index
									second_to_last_index = older_indices.pop();
									// Add the oldest index to the stack - we'll
									// need to delete that
									older_indices.push(oldest_index);
								}
    							// Add the latest index - we'll need to delete
								// that also
								older_indices.push(latest_index);
								
								// Remove all actions except the 2nd to last one
								// (it should have been removed
								// from the older_indices stack above)
								for(var cur = 0; cur < older_indices.length; cur++) {
									sql = "DELETE FROM _dbs_sync_actions WHERE id=?";
									
									// DEBUG:
									console.log("Deleting index " + older_indices[cur] + " which is id " +
											older_indices[cur].id + " and record_id " + older_indices[cur].record_id);
									tx.executeSql(sql, [results.rows.item(older_indices[cur]).id], function(tx, results) {
										self.success_handler("Deleted older duplicate actions in _dbs_sync_actions table");
									}, function(tx, err) {
										self.error_handler("Error deleting duplicate in _dbs_sync_actions table.");
									});
								}
								
								// Change the second to last action to an insert
								// if it isn't already
    							if(results.rows.item(second_to_last_index).sync_action !==
    								'insert') {
    								
    								sql = "UPDATE _dbs_sync_actions SET sync_action='insert' WHERE id=?";
    								tx.executeSql(sql, [results.rows.item(second_to_last_index).id], 
    									function(tx, results) {
											self.success_handler("Updated older duplicate actions in _dbs_sync_actions table");
										}, function(tx, err) {
										self.error_handler("Error updating duplicate in _dbs_sync_actions table.");
									});
    							}
    							// }
    						}
    						else {
    							self.error_handler("Unexpected error in sync table reduction: latest sync " + 
    									"record with duplicate record_id is neither an update or a delete" +
    									" (first record was an INSERT).");
    						}
    						
    						
    					}
    					
    					// Is the older action an update?
    					if (results.rows.item(oldest_index).sync_action === "update") {
    						
    						// Situation 3: update then another update AND
							// situation 4: update then delete
    						if (results.rows.item(latest_index).sync_action === "update" || 
    						 results.rows.item(latest_index).sync_action === "delete") {
    							// Remove the older records (oldest_index &
								// older_indices), just keep
								// the most recent, whether it be an update or a
								// delete
								// First, push the oldest index on the
								// older_indices stack
    							older_indices.push(oldest_index);
    							
    							// Remove all older records
    							for(var cur = 0; cur < older_indices.length; cur++) {
    								sql = "DELETE FROM _dbs_sync_actions WHERE id=?";
    								
    								tx.executeSql(sql, [results.rows.item(older_indices[cur]).id], function(tx, results) {
    									self.success_handler("Deleted older duplicate actions in _dbs_sync_actions table");
    								}, function(tx, err) {
    									self.error_handler("Error deleting duplicate in _dbs_sync_actions table.");
    								});
    							}
    						}
    						else {
    							self.error_handler("Unexpected error in sync table reduction: latest sync " + 
    									"record with duplicate record_id is neither an update or a delete" +
    									" (first record was an UPDATE).");
    						}
		
    						
    					}
    				}
    			}
    			
    			// Call the callback, passing the number of records from sync
				// table
    			callback(results.rows.length);
    		}, function(tx, err) {
    				self.error_handler("Error selecting sync_actions table during sync table reduction");
    		});},
    			
    		
    	function(err) {
        	self.error_handler("Could not open database (reduce_sync_table): " + err.message);
        },
        function() {
            self.success_handler("Opened the database (reduce_sync_table).");
        });
    },
    _sync_record: function(sync_id, is_last_record) {
    	 var db = window.openDatabase(this.local_db_name, this.db_ver, this.db_readable_name, this.size);
         self = this;
         
         // Register an error function to be called if there is an error
			// during AJAX
         $(document).ajaxError(function(e,j,as,error) {
        	console.log("AJAX error: " + error);
         });
         
         db.transaction(function(tx) {
        	 sql = "SELECT * FROM _dbs_sync_actions WHERE id=?";
        	 tx.executeSql(sql, [sync_id], function(tx, sync_actions_results) {
        		table_name = sync_actions_results.rows.item(0).table_name;
                record_id = sync_actions_results.rows.item(0).record_id;
                sync_action = sync_actions_results.rows.item(0).sync_action;
                sync_timestamp = sync_actions_results.rows.item(0).timestamp;
                // Get the data from the record being synced
                sql = "SELECT * FROM " + table_name + 
                            " WHERE id=?";
                console.log("get data sql:" + sql);
                tx.executeSql(sql, [record_id], function(tx, table_results) { 
                	table_data = table_results.rows.item(0);
                    
                    // Extract the column names and values from the row
                    var columns = $.map(table_data, function(value, key) {
                    	return key;
                    });
                    var values = $.map(table_data, function(value, key) {
                    	if (value == null) {
                    		value = 0;
                    	}
                    	return value;
                    });
                    
                    
                    console.log("sync_action is a(n) " + sync_action);
                    // Lookup the highest id of the local table
                    var sql = "SELECT max(" + self.id_col + ") AS max_id FROM " + table_name;
                                        
                    tx.executeSql(sql, [], function(tx, highest_id_results) {
                    	var highest_id = highest_id_results.rows.item(0).max_id;
                    	console.log("highest id:" + highest_id);
                    	
                        // Send the data to the server
                        $.post(self.server_URL, {action:sync_action, 
                        		table:table_name, 
                        		table_d:table_data,
                        		timestamp:sync_timestamp,
                        		data_columns:columns, data_values:values, 
                                id:record_id,
                        		max_id:highest_id, 
                                id_col:self.id_col,
                        		remote_db:self.server_db_name,
                        		direction:"client_to_server"},
                                function (data) {self._sync_callback(data, is_last_record);}, "json");
                    	}, 	
                    	function(tx, err) { 
                    	self.error_handler("Could not lookup the max id from a table: " 
                    		+ err.message);
                    });
                       
                    
                }, 
                function(tx, err) {
                	self.error_handler("Could not select data to send from the local database: " + 
                			err.message);
                });
                	
            },
            function(tx, err) {
            	self.error_handler("Cound not select record from _dbs_sync_actions table (_sync_record): " + err.message);
            });
            
    	 }, 
    	 function(err) {
    		 self.error_handler("Could not open database (_sync_record): " + err.message);
    	 }, 
    	 function() {
    		 self.success_handler("Opened the database (_sync_record)");
    	 }       	 
    	 );
    	
    },
    _sync_callback: function(data, is_last_record) {
    	// Called after the server responds in this.sync()
        
    	console.log("in sync callback");
    	// console.log("returned data: " + JSON.stringify(data));
    	console.log("is_last_record = " + is_last_record);
    	console.log("raw data: " + data);
    	console.log("can client understand data? : data.message=" + data.message);
    	var sql;
   
        self = this;
        
    	if(data.err) {
            this.error_handler("Error received back from server: " + data.err_msg);
            return;
        }
 	   	else {
 	   		// Call the function that will handle any local update
 	   		// The rest of the code will be called after any local update is
			// complete
 	   		self._local_update(data, function() {
 	   			
 	   		var db = window.openDatabase(self.local_db_name, self.db_ver, self.db_readable_name, self.size);
 	        
 	   		// Client record was successfully synced; increment the counter
 	   		self.num_client_records++;
 	   		
            // Delete the sync table record
    		db.transaction(function(tx) {
    			sql = "DELETE FROM _dbs_sync_actions WHERE record_id=? AND sync_action=?";
    			
    			tx.executeSql(sql, [data.old_id, data.action], function() {
    				// DEBUG
    				// console.log("sql: " + sql + "record_id:" + data.old_id +
					// " action:" + data.action);
    				
    				self.success_handler("Deleted the record in the _dbs_sync_actions table");
    				// If this is the last record
                	if(is_last_record) {
                		// Sync in the other direction
                		// DEBUG:
                		console.log("This was the last record...starting server to client sync...");
                		
                		self._server_to_client_sync();
                	}
                
    			}, function(tx, err) {
    				self.error_handler("Couldn't delete record in the _dbs_sync_actions table: " + err.message);
    			});
        		      	

    		}, function(err) { self.error_handler("Could not open database (_sync_callback): " + err.message); }, 
    		self.success_handler("Opened the database."));
        	
 	   		});
        }
        
        
        
    },
    _local_update: function(data, callback) {
       
		// if(data.action == "insert") {
            this.success_handler(data.action + " action for table '" + data.table + "' id#" + data.new_id +
                            " accepted by server.");
            if(data.has_new_id) {
            	var db = window.openDatabase(this.local_db_name, this.db_ver, this.db_readable_name, this.size);
                
            	db.transaction(function(tx) {
                    sql = "UPDATE " + data.table + " SET " + self.id_col + "=? WHERE " + 
                              self.id_col + "=?";
                    tx.executeSql(sql, [data.new_id, data.old_id], function (tx, err) {
                    	
                    	self.success_handler("Updated a local id# in table '" + data.table + "':" + 
                                data.id_col + " changed:" + data.old_id + "-->" + data.new_id);
                    	
                    	
                    	// Delete the automatically generated sync action record - we don't want
                    	//  to resync this
                    	sql = "DELETE FROM _dbs_sync_actions WHERE record_id=? AND table_name=?";
                    	tx.executeSql(sql, [data.new_id, data.table], function(tx) {
                    		self.success_handler("Successfully deleted auto-generated sync action record.");
                    		callback();
                    	}, function (tx, err) {
                    		self.error_handler("Error deleting auto-generated sync action record:" +
                    				err.message);
                    	});
                    	
                    	
                    	
                    }, function(tx, err) {
                    	
                    	
                        self.error_handler("Error updating id in table '" + data.table + "':" + 
                                        self.id_col + " changed:" + data.old_id + "-->" + 
                                        data.new_id + ", error: " + err.message);
                    });
                }, function(err) {
                	self.error_handler("Could not open database (_sync_callback): " + err.message); 
                },
                self.success_handler("Opened the database (_sync_callback)."));
     
            }
            else {
            	callback();
            }
       
        // }
        /*
		 * else if(data.action == "delete") { // IF USING LOGICAL DELETES, don't
		 * need to do anything // If in the future using actual deletes, the
		 * code to delete the local record // might go here -- or a separate
		 * function could be called to do the deleting after // all syncing is
		 * complete this.success_handler("Delete action for table '" +
		 * data.table + "' id#" + data.old_id+ " accepeted by server.");
		 * callback(); } else if(data.action == "update") {
		 * this.success_handler("Update action for table '" + data.table + "'
		 * id#" + data.old_id + " accepeted by server."); callback(); }
		 */

    },
    _server_to_client_sync: function() {
    	// @NEEDS TESTING
    	
    	// Register an ajax error handler
    	$(document).ajaxError(function(e,j,as,error) {
        	console.log("AJAX error: " + error);
         });
    	self = this;
    	// DEBUG:
    	console.log("in _server_to_client_sync");
    	
    	$.post(this.server_URL, {action:"get_server_sync_data", remote_db:this.server_db_name, 
			 direction:"server_to_client"}, function (data) {self._server_to_client_sync_callback(data);}, "json");
		
    },
    
  
    _server_to_client_sync_callback: function(data) {
    	// Assumptions made (that should be true from prior processing):
    	// No two sync_records are associated with the same table & record_id
		// (i.e. server sync table reduced)
    	// Any conflicts have already been detected and handled by the server
    	
    	var db = window.openDatabase(this.local_db_name, this.db_ver, this.db_readable_name, this.size);
        
    	// console.log("data:" + JSON.stringify(data));
    	// console.log("raw data:" + data);
    	
    	// If no server records
    	if (data[0].server_has_records === 0) {
    		console.log("Server has no records to sync.  Sync complete.");
    		this.success_callback(this.num_client_records, 0);
    	}
    	    	
    	self = this;
    	db.transaction(function(tx) {
    		var is_last_server_record = false;
    		
    		// Process the data
	    	for (var cur = 0; cur < data.length; cur++) {
	    		
	    		// If this is the last server record, set a flag so success callback can be called
	    		//  (at the completion of the sync of the last record)
	    		if (cur === data.length - 1) {
	    			is_last_server_record = true;
	    		}
	    		//tx.sync_id = data[cur].id;  // Save the id for the success
											// callback
	    		
	    		
	    		if (data[cur].sync_action === "insert") {
	    			// Build the sql statement
	        		sql = "INSERT INTO " + data[cur].table_name + "(";
	        		for (cur_col = 0; cur_col < data[cur].data_columns.length; cur_col++) {
	        			// Concatenate with each of the column names
	        			sql = sql + data[cur].data_columns[cur_col] + ",";
	        		}
	        		// Remove last comma, and concatenate some more of the sql
	        		sql = sql.substring(0, sql.length - 1) + ") VALUES (";
	        		
	        		for (cur_col = 0; cur_col < data[cur].data_values.length; cur_col++) {
	        			sql = sql + "?,";
	        		}
	        		// Remove last comma, add parenthesis
	        		sql = sql.substring(0, sql.length - 1) + ")";

	        		// DEBUG:
	        		console.log("insert sql (on conflict): " + sql);
	        		
	        		// Execute the insert (needed to create a separate function
					// so that a new
	        		// "instance" of this function was called for each record)
	        		self._execute_server_action(tx, sql, data[cur].data_values, data[cur].record_id,
	        				data[cur].table_name, data[cur].id, is_last_server_record);
	        		
	    		}
	    		else if(data[cur].sync_action === "update") {
	    			// @NEEDS TESTING
	    			// Update the record in the database - again, assume no
					// timestamp conflicts
		    		
		    		// Build the sql statement
		    		sql = "UPDATE " + data[cur].table_name + " SET ";
		    		
		    		for(cur_col = 0; cur_col < data[cur].data_columns.length; cur_col++) {
		    			console.log("cur_col=" + cur_col + ", data[cur].data_columns[cur_col]=" + 
		    					data[cur].data_columns[cur_col]);
		    			sql = sql + data[cur].data_columns[cur_col] + "=?,";
		    		}
		    		// Remove last comma and tack
		    		sql = sql.substring(0, sql.length-1);
		    		
		    		// Add the WHERE clause
		    		sql = sql + " WHERE " + self.id_col + "=" + data[cur].record_id;
		    		
		    		// Execute the update
		    		self._execute_server_action(tx, sql, data[cur].data_values, data[cur].record_id, 
		    				data[cur].table_name, data[cur].id, is_last_server_record);
		    		
	    		}
	    		else if (data[cur].sync_action === "delete") {
	    			// @NEEDS TESTING
	    			// Mark the local record as deleted
		    		sql = "UPDATE " + data[cur].table_name + " SET _is_deleted=1 WHERE " + self.id_col + 
		    				"=" + data[cur].record_id;
		    		
		    		// Execute the 'delete' (logical)
		    		self._execute_server_action(tx, sql, [], data[cur].record_id, data[cur].table_name, 
		    				data[cur].id, is_last_server_record);
		    		
	    		}
    		    	
	    			
	    	}
    
    	}, function (err) {
    		self.error_handler("Error opening the database (_server_to_client_sync_callback) " + err.message);
    	}, function () {
    		self.success_handler("Opened the database");
    	});
	   
    },
    _execute_server_action: function(tx, sql, data, record_id, table_name, sync_id, is_last_server_record) {
    	self = this;
    	
    	console.log("in _execute_server_action");
    	console.log("sql:" + sql);
    
    	tx.executeSql(sql, data, function(tx) {
    		// Delete the automatically generated sync action record (from trigger) - we don't want
        	//  to resync this
        	sql = "DELETE FROM _dbs_sync_actions WHERE record_id=? AND table_name=?";
        	
        	/*
        	var record_id;
        	if (data.has_new_id) record_id = data.new_id;
        	else record_id = data.old_id;
        	*/
        	console.log("record_id = " + record_id);
        	console.log("table_name = " + table_name);
        	tx.executeSql(sql, [record_id, table_name], function(tx) {
        		self.success_handler("Successfully deleted auto-generated sync action record.");
        	}, function (tx, err) {
        		self.error_handler("Error deleting auto-generated sync action record:" +
        				err.message);
        	});
			
    		
    		// Tell the server that it can delete its corresponding sync record
    		console.log("sync_id=" + sync_id);
			self._delete_server_sync_record(sync_id, is_last_server_record);
			self.success_handler("Processed the server record successfully.");
			// Increment the server record counter
			self.num_server_records++;
			
		}, function(tx, err) {
			self.error_handler("Error processing a record sent from server: " + err.message);
		});
    },
    _delete_server_sync_record: function(sync_id, is_last_server_record) {
    	// @Could probably just put this code directly in _execute_server_action
    	//
    	// Called when a server sync record is no longer required because it has
		// been successfully synced on
    	// client; tells the server to delete the sync record indicated by
		// 'sync_id'
    	self = this;
    	
    	$.post(this.server_URL, {action:"delete_sync_record", remote_db:this.server_db_name, 
			 direction:"server_to_client", sync_record_id:sync_id}, function() {
				 if (is_last_server_record) {
					 self.success_callback(self.num_client_records, self.num_server_records);
				 }
			 });
		
    	
    },
    /*
    log_delete: function(table, id) {
        this.log_sync_action(table, id, "delete");
    },
    
    log_insert: function(table, id) {
        this.log_sync_action(table, id, "insert");
    },
    
    log_update: function(table, id) {
        this.log_sync_action(table, id, "update");
    },
    
    
    // 'PRIVATE' methods:
    log_sync_action: function(table, id, type) {
        // log_sync_action(type, id) : Called by user manually every time a
		// change in the local database is made
        //
        // type can be either "insert", "delete", or "update"
        // id is the id number of the record changed
        var db = window.openDatabase(this.local_db_name, this.db_ver, this.db_readable_name, this.size);
    
        self = this;
        db.transaction(
            function(tx) {
                var sql = "INSERT INTO _dbs_sync_actions (table_name, record_id, sync_action, timestamp) VALUES (?, ?, ?, datetime('now'))";
                tx.executeSql(
                	sql, [table, id, type], function() {
                		self.success_handler("Successfully inserted record into _dbs_sync_actions table.");
                	}, function(tx, err) {
                		self.error_handler("Could not insert a record into _dbs_sync_actions table " + 
                					err.message);
                	}
                );
                    
            }, 
            function(tx, err) { 
            	self.error_handler("Could not open database (log_sync_action) " + err.message);
            },
            self.success_handler("Successfully opened the database (log_sync_action).")
        );
        
     
    },
    */
    
       
    error_handler: function(msg) {
        console.log("DB_Syncer error: " + msg);
        return;
    },
    
    success_handler: function(msg) {
        console.log("DB_Syncer success: " + msg);
        return;
    },
    
    /* Development functions */
    _empty_sync_table: function() {
    	 var db = window.openDatabase(this.local_db_name, this.db_ver, this.db_readable_name, this.size);
         self = this;
         db.transaction(function(tx) {
             // Drop the sync table
             var sql = "DELETE FROM _dbs_sync_actions WHERE 1";
             tx.executeSql(sql, [], function() { 
            	 self.success_handler("Emptied the _dbs_sync_actions table."); 
             }, function(tx, err) {
            	 self.error_handler("Couldn't empty the _dbs_sync_actions table: " + err.message);
             });
         
	         
         
         }, function(err) {
        	 self.error_handler("Couldn't open the database: " + err.message);
         }, function() {
        	 self.success_handler("Opened the database.");
         });
         
         
         
       
        	
    	
    },
    _reset_db_triggers: function () {
    	// Drop any created triggers
	    for (var cur = 0; cur < this.tables_to_sync.length; cur++) {
	    	this._reset_table_triggers(this.tables_to_sync[cur]);
	    }
        	
        	
        
    },
    _reset_table_triggers: function(table_name) {
    	var db = window.openDatabase(this.local_db_name, this.db_ver, this.db_readable_name, this.size);
        self = this;
        db.transaction(function(tx) {
    	
	    	sql = "DROP TRIGGER IF EXISTS insert_" + table_name;
	   	  	tx.executeSql(sql,[], function() {
	   	  		console.log("Dropped an insert trigger");
	   	  		console.log("Recreating insert trigger...");
	   	  		sql = "CREATE TRIGGER IF NOT EXISTS insert_" + table_name + " AFTER INSERT ON " +
	   	  			table_name + 
	   	  			" BEGIN " +
	   	  				" INSERT INTO _dbs_sync_actions (table_name, record_id, sync_action," +
	   	  				"timestamp) VALUES ('" + table_name + 
	   	  				"', NEW.id,'insert',datetime('now'));" +
	   	  				"END;";
	   		
	   		
	   	  		tx.executeSql(sql, [], function () {
	   	  			console.log("Successfully created insert trigger on table " + table_name);
	   	  		}, function(tx, err) {
	   	  			console.log("Error creating trigger on table " + table_name + ":" +
	   					err.message);
	   	  		});
	   	  
	   	  	},
	   	  	function(tx, err) {
	   		  	console.log("Error dropping an insert trigger: " + err.message);
	   	  	});
	   	  	
	   	  	sql = "DROP TRIGGER IF EXISTS update_" + table_name;
			tx.executeSql(sql,[], function() {
				console.log("Dropped an update trigger");
				console.log("Recreating update trigger...");
				
        		sql = "CREATE TRIGGER IF NOT EXISTS update_" + table_name + " AFTER UPDATE ON " +
        				table_name +
        				" BEGIN " +
        				" INSERT INTO _dbs_sync_actions (table_name, record_id, sync_action," +
        				"timestamp) VALUES ('" + table_name + 
        				"', NEW.id,'update',datetime('now'));" +
        				"END;";
        		
        		tx.executeSql(sql, [], function () {
        			console.log("Successfully created update trigger on table " + table_name);
        		}, function(tx, err) {
        			console.log("Error creating trigger on table " + table_name + ":" +
        					err.message);
        		});
			},
			function(tx, err) {
				console.log("Error dropping an update trigger");
			});
		  
			sql = "DROP TRIGGER IF EXISTS delete_" + table_name;
			tx.executeSql(sql,[], function() {
				console.log("Dropped an delete trigger");
			},
			function(tx, err) {
				console.log("Error dropping an delete trigger");
			});
	    }, 
	    function(err) {
	    	self.error_handler("Couldn't open the database: " + err.message);
	    }, 
	    function() {
	    	self.success_handler("Opened the database.");
	    });
    },
        
    
}
    
    
