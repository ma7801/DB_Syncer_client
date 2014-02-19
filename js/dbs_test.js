function create_db() {
	var db = window
			.openDatabase("_sync_test", "1.0", "DB_Syncer test", 1000000);
	db
			.transaction(
					function(tx) {
						var sql = "DROP TABLE IF EXISTS test_data";
						tx
								.executeSql(
										sql,
										[],
										function() {
											console
													.log("successfully dropped the table");
											sql = "CREATE TABLE test_data ("
													+ "id INTEGER PRIMARY KEY AUTOINCREMENT, "
													+ "data VARCHAR(20), "
													+ "_is_deleted BOOLEAN DEFAULT 0)";
											console
													.log("sql statement: "
															+ sql);
											tx
													.executeSql(
															sql,
															[],
															function() {
																console
																		.log("successfully created table test_data");
															},
															function(tx, err) {
																console
																		.log("error creating table test_data:"
																				+ err.message);
															});
										}, function(tx, err) {
											console.log("error dropping table:"
													+ err.message);
										});
					}, function(tx, err) {
						console.log("error opening database:" + err.message);
					}, function() {
						console.log("opened the database");
					});

	dbs = new DB_Syncer("_sync_test", "1.0", "DB_Syncer test", 1000000);
	dbs._drop_sync_table();

}

function sync_db() {
	dbs = new DB_Syncer("_sync_test", "1.0", "DB_Syncer test", 1000000);
	dbs.set_server_URL("http://192.168.119.50/DB_Syncer/DB_Syncer_listener.php");
	dbs.set_remote_db("test");
	dbs.set_id_col("id");

	dbs.sync();

}

function create_random_data() {
	var num_records = parseInt(window.prompt("Number of random records: ", "20"));
	var db = window.openDatabase("_sync_test", "1.0", "DB_Syncer test", 1000000);

	dbs = new DB_Syncer("_sync_test", "1.0", "DB_Syncer test", 1000000);

	for ( var cur = 0; cur < num_records; cur++) {
		var sql = "INSERT INTO test_data (data) VALUES (?)";

		db.transaction(function(tx) {
			var sql = "INSERT INTO test_data (data) VALUES (?)";
			tx.executeSql(sql, [ Math.round(Math.random() * 1000) ], function(
					tx, results) {
				console.log("successfully inserted data");
				dbs.log_insert("test_data", results.insertId);

			}, function(tx, err) {
				console.log("error inserting data: ", err.message);
			});
		}, function() {
			console.log("error opening the database")
		}, function() {
			console.log("opeend the database")
		});
	}
}

function create_random_actions() {
	var num_actions = parseInt(window.prompt("Number of random actions: ", "30"));
	var db = window.openDatabase("_sync_test", "1.0", "DB_Syncer test", 1000000);

	dbs = new DB_Syncer("_sync_test", "1.0", "DB_Syncer test", 1000000);

	var actions = new Array("insert", "update", "delete");

	var record_num;
	var random_id;
	var deleted_records = new Array();

	// The 'for' loop defined as a recursive function
	var add_record = function(tx, cur) {

		// Base case
		if (cur === 0) {
			return;
		}

		console.log("num_records=" + num_records);  // Why this is in scope, I don't know, but it works!
		
		var random_index = Math.floor(Math.random() * 3);
		if (random_index === 3) random_index = 2;
		var cur_action = actions[random_index];
		

		if (cur_action === "insert") {
			sql = "INSERT INTO test_data (data) VALUES (?)";
			tx.executeSql(sql, [ Math.round(Math.random() * 1000) ], function(
					tx, results) {
				console.log("successfully inserted data");
				dbs.log_insert("test_data", results.insertId);
				add_record(tx, cur - 1);
			}, function(err) {
				console.log("error inserting data: ", err.message);
			});
			num_records++;
		} 
		else if (cur_action === "update") {

			random_id = Math.round(Math.random() * (num_records-1)) + 1;
			console.log("deleted records: " + deleted_records);
			var iteration = 0;
			while ($.inArray(random_id, deleted_records) !== -1) {

				random_id = Math.round(Math.random() * (num_records-1)) + 1;
				console.log("random_id" + random_id);
				iteration++;
				if (iteration > 10000) { break;}  // No infinite looping!
			}

			sql = "UPDATE test_data SET data=-"
					+ Math.round(Math.random() * 1000) + " WHERE id="
					+ random_id;
			tx.executeSql(sql, [], function(tx, results) {
				console.log("successfully updated data");
				dbs.log_update("test_data", random_id);
				add_record(tx, cur - 1);
			}, function(err) {
				console.log("error updating data: ", err.message);
			});
		} 
		else if (cur_action === "delete") {
			random_id = Math.round(Math.random() * (num_records-1)) + 1

			sql = "UPDATE test_data SET _is_deleted=1 WHERE id=" + random_id;
			tx.executeSql(sql, [], function(tx, results) {
				console.log("successfully updated data");
				dbs.log_delete("test_data", random_id);

				// Mark as deleted within function - just easier
				deleted_records.push(random_id);
				add_record(tx, cur - 1);
			}, function(err) {
				console.log("error updating data: ", err.message);
			});

		}

	}

	// See how many records there are
	db.transaction(function(tx) {

		var sql = "SELECT * FROM test_data";
		tx.executeSql(sql, [], function(tx, results) {

			num_records = results.rows.length;

			// Call add_record for the first time
			add_record(tx, num_actions);

		}, function(tx, err) {
			console.log("error selecting records from test_data");
		});
	}, function(err) {
		console.log("error opening database");
	}, function() {
		console.log("opened the database");
	});
}

function insert_record() {
	var data = window.prompt("Data to insert: ", Math.round(Math.random() * 1000));
	var db = window	.openDatabase("_sync_test", "1.0", "DB_Syncer test", 1000000);

	dbs = new DB_Syncer("_sync_test", "1.0", "DB_Syncer test", 1000000);

	db.transaction(function(tx) {
		var sql = "INSERT INTO test_data (data) VALUES (?)";
		tx.executeSql(sql, [ data ], function(tx, results) {
			console.log("successfully inserted data");
			dbs.log_insert("test_data", results.insertId);
		}, function(tx, err) {
			console.log("error inserting data: ", err.message);
		});
	}, function() {
		console.log("error opening the database")
	}, function() {
		console.log("opeend the database")
	});

}

function delete_record() {
	var id = parseInt(window.prompt("id to delete: ", "1"));
	var db = window
			.openDatabase("_sync_test", "1.0", "DB_Syncer test", 1000000);

	dbs = new DB_Syncer("_sync_test", "1.0", "DB_Syncer test", 1000000);

	db.transaction(function(tx) {
		var sql = "UPDATE test_data SET _is_deleted=1 WHERE id=?";
		tx.executeSql(sql, [ id ], function(tx, results) {
			console.log("successfully deleted data");
			dbs.log_delete("test_data", id);
		}, function(tx, err) {
			console.log("error deleting data: " + err.message);
		});
	}, function() {
		console.log("error opening the database")
	}, function() {
		console.log("opened the database")
	});

}

function update_record() {
	var id = parseInt(window.prompt("id to update: ", "1"));
	var data = window.prompt("New data: ", Math.round(Math.random() * 1000));
	var db = window
			.openDatabase("_sync_test", "1.0", "DB_Syncer test", 1000000);

	dbs = new DB_Syncer("_sync_test", "1.0", "DB_Syncer test", 1000000);

	db.transaction(function(tx) {
		var sql = "UPDATE test_data SET data=? WHERE id=?";
		tx.executeSql(sql, [ data, id ], function(tx, results) {
			console.log("successfully updated data");
			dbs.log_update("test_data", id);
		}, function(tx, err) {
			console.log("error updating data: " + err.message);
		});
	}, function() {
		console.log("error opening the database")
	}, function() {
		console.log("opened the database")
	});

}
