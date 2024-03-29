package org.smap.sdal.Utilities;

import java.sql.Connection;
import java.util.logging.Level;
import java.util.logging.Logger;

import javax.naming.InitialContext;
import javax.sql.DataSource;

public class SDDataSource {
	
	private static Logger log =
			 Logger.getLogger(SDDataSource.class.getName());
	
	private SDDataSource() {
	}
	
	public static Connection getConnection(String requester) {

		try {
			InitialContext cxt = new InitialContext();
			DataSource ds = (DataSource) cxt.lookup( "java:/comp/env/jdbc/survey_definitions" );

			Connection c = ds.getConnection();
			c.setAutoCommit(true);		// Can't rely on auto commit being set to true when connection comes from pool
			log.info("Got definitions connection: " + requester + " : " + c.toString());
			return c;
		} catch (Exception e) {
			log.log(Level.SEVERE, "Error getting SD data source", e);
			return null;
		}
	}
	

}
