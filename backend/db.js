const mysql = require('mysql');
const con = mysql.createConnection(
	{
		host: 'localhost',
		user: 'root',
		password: '',
		database: 'dbsiformat'
	});

con.connect((err) => {
		if(err){
			console.error('Error Connection to MySql', err);
			return;
		}
		console.log('Connected to MySql');

	});

module.exports = con;
