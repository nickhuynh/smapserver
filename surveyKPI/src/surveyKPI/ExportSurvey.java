package surveyKPI;

import java.io.PrintWriter;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Set;
import java.util.logging.Level;
import java.util.logging.Logger;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Application;
import javax.ws.rs.core.Context;

import org.apache.commons.lang3.StringEscapeUtils;
import org.smap.sdal.Utilities.Authorise;
import org.smap.sdal.Utilities.ResultsDataSource;
import org.smap.sdal.Utilities.SDDataSource;
import org.smap.sdal.Utilities.UtilityMethodsEmail;

/*
 * Provides a survey level export of a survey as an XLS file
 * If the optional parameter "flat" is passed then this is a flat export where 
 *   children are appended to the end of the parent record.
 *   
 * If this parameter is not passed then a pivot style export is created.
 *  * For example for a parent form with a repeating group of children we might get:
 *    P1 C1
 *    P1 C2
 *    P1 C3
 *    P2 C4
 *    P2 C5
 *    P3 ...    // No children
 *    P4 C6
 *    etc
 *    
 */
@Path("/exportSurvey/{sId}/{filename}")
public class ExportSurvey extends Application {
	
	Authorise a = new Authorise(null, Authorise.ANALYST);
	
	private static Logger log =
			 Logger.getLogger(ExportSurvey.class.getName());
	
	// Tell class loader about the root classes.  (needed as tomcat6 does not support servlet 3)
	public Set<Class<?>> getClasses() {
		Set<Class<?>> s = new HashSet<Class<?>>();
		s.add(Items.class);
		return s;
	}
	
	private class Column {
		int q_id = 0;
		int o_id = 0;
		String q_name;
		String o_name;
		String q_type;
		String col_name;
		
		public String toString() {
			return ("  " + col_name + " : " + q_type);
		}
	}
	
	private class RecordDesc {
		String prikey;
		String parkey;
		StringBuffer record;
	}
	
	private class FormDesc {
		String f_id;
		String parent;
		String table_name;
		String columns = null;
		String parkey = null;
		Integer maxRepeats;
		int columnCount = 0;					// Number of displayed columns for this form
		Boolean visible = true;					// Set to false if the data from this form should not be included in the export
		Boolean flat = false;					// Set to true if this forms data should be flattened so it appears on a single line
		ArrayList<RecordDesc> records = null;
		ArrayList<FormDesc> children = null;
		
		public void debugForm() {
			System.out.println("Form=============");
			System.out.println("    f_id:" + f_id);
			System.out.println("    parent:" + parent);
			System.out.println("    table_name:" + table_name);
			System.out.println("    maxRepeats:" + maxRepeats);
			System.out.println("    visible:" + visible);
			System.out.println("    flat:" + flat);
			System.out.println("End Form=============");
		}
		
		public void clearRecords() {
			records = null;
				if(children != null) {
				for(int i = 0; i < children.size(); i++) {
					children.get(i).clearRecords();
				}
			}
		}
		
		public void addRecord(String prikey, String parkey, StringBuffer rec) {
			if(records == null) {
				records = new ArrayList<RecordDesc> ();
			}

			RecordDesc rd = new RecordDesc();
			rd.prikey = prikey;
			rd.parkey = parkey;
			rd.record = rec;
			records.add(rd);
		}
		
		public void printRecords(int spacing, boolean long_form) {
			String padding = "";
			for(int i = 0; i < spacing; i++) {
				padding += " ";
			}

			if(records != null) {		
				for(int i = 0; i < records.size(); i++) {
					if(long_form) {
						System.out.println(padding + f_id + ":  " + records.get(i).prikey + 
								" : " + records.get(i).record.toString() );
					} else { 
						System.out.println(padding + f_id + ":  " + records.get(i).record.substring(0, 50));
					}
				}
			}
			
			if(long_form && children != null) {
				for(int i = 0; i < children.size(); i++) {
					children.get(i).printRecords(spacing + 4, long_form);
				}
			}
		}
	}

	ArrayList<StringBuffer> parentRows = null;
	private boolean csv = false;
	
	@GET
	@Produces("application/x-download")
	public void exportFlat (@Context HttpServletRequest request, 
			@PathParam("sId") int sId,
			@PathParam("filename") String filename,
			@QueryParam("flat") boolean flat,
			@QueryParam("split_locn") boolean split_locn,
			@QueryParam("merge_select_multiple") boolean merge_select_multiple,
			@QueryParam("language") String language,
			@QueryParam("format") String format,
			@QueryParam("exp_ro") boolean exp_ro,
			@QueryParam("forms") String include_forms,
			
			@Context HttpServletResponse response) {

		String urlprefix = request.getScheme() + "://" + request.getServerName() + "/";		
		HashMap<String, String> selectMultipleColumnNames = new HashMap<String, String> ();
		HashMap<String, String> selMultChoiceNames = new HashMap<String, String> ();
		
		try {
		    Class.forName("org.postgresql.Driver");	 
		} catch (ClassNotFoundException e) {
			log.log(Level.SEVERE, "Can't find PostgreSQL JDBC Driver", e);
		    try {
		    	response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, 
		    		"Survey: Error: Can't find PostgreSQL JDBC Driver");
		    } catch (Exception ex) {
		    	log.log(Level.SEVERE, "Exception", ex);
		    }
		}
		
		// Set defaults
		if(format == null) {	// Default to XLS
			format = "xls";
		}
		
		log.info("New export, format:" + format + " flat:" + flat + " split:" + split_locn + 
				" forms:" + include_forms + " filename: " + filename + ", merge select: " + merge_select_multiple);
		
		if(format.equals("csv")) {		// Only 2 formats currently supported:  CSV or XLS = not CSV
			csv = true;
		} else {
			csv = false;
		}
		
		// Authorisation - Access
		Connection connectionSD = SDDataSource.getConnection("surveyKPI-ExportSurvey");
		a.isAuthorised(connectionSD, request.getRemoteUser());
		a.isValidSurvey(connectionSD, request.getRemoteUser(), sId, false);
		// End Authorisation
		
		String escapedFileName = null;
		try {
			escapedFileName = URLDecoder.decode(filename, "UTF-8");
			escapedFileName = URLEncoder.encode(escapedFileName, "UTF-8");
		} catch (Exception e) {
			log.log(Level.SEVERE, "Encoding Filename Error", e);
		}
		escapedFileName = escapedFileName.replace("+", " "); // Spaces ok for file name within quotes
		escapedFileName = escapedFileName.replace("%2C", ","); // Commas ok for file name within quotes

		if(csv) {
			escapedFileName = escapedFileName + ".csv";
		} else {
			escapedFileName = escapedFileName + ".xls";
			response.setHeader("Content-type",  "application/vnd.ms-excel; charset=UTF-8");
		}	
		response.setHeader("Content-Disposition", "attachment; filename=\"" + escapedFileName +"\"");	
		response.setStatus(HttpServletResponse.SC_OK);
		
		if(language != null) {
			language = language.replace("'", "''");	// Escape apostrophes
		} else {
			language = "none";
		}
		
		/*
		 * Get the list of forms to include in the output and their types (ie flat or pivot)
		 */
		int inc_id [] = null;
		boolean inc_flat [] = null;
		if(include_forms != null) {
			String iForms [] = include_forms.split(",");
			if(iForms.length > 0) {
				inc_id = new int [iForms.length];
				inc_flat = new boolean [iForms.length];
				for(int i = 0; i < iForms.length; i++) {
					String f[] = iForms[i].split(":");
					if(f.length > 1) {
						try {
							inc_id[i] = Integer.parseInt(f[0]);
							inc_flat[i] = Boolean.valueOf(f[1]);
						} catch (Exception e) {
							log.info("Invalid form argument in export: " + iForms[i]);
						}
					}
					
				}
			}
		}
		
		PrintWriter outWriter = null;
		StringBuffer qName = new StringBuffer();
		StringBuffer qText = new StringBuffer();

		if(sId != 0) {
			
			PreparedStatement pstmt2 = null;
			PreparedStatement pstmtSSC = null;
			PreparedStatement pstmtQType = null;
			Connection connectionResults = null;
			
			
			
			try {
				// Prepare statement to get server side includes
				String sqlSSC = "select ssc.name, ssc.function, ssc.type from ssc ssc, form f " +
						" where f.f_id = ssc.f_id " +
						" and f.table_name = ? " +
						" order by ssc.id;";
				pstmtSSC = connectionSD.prepareStatement(sqlSSC);
				
				// Prepare the statement to get the question type and read only attribute
				String sqlQType = "select q.qtype, q.readonly from question q, form f " +
						" where q.f_id = f.f_id " +
						" and f.table_name = ? " +
						" and q.qname = ?;";
				pstmtQType = connectionSD.prepareStatement(sqlQType);
					
				// Create an output writer to incrementally download the spreadsheet
				outWriter = response.getWriter();
				
				HashMap<String, FormDesc> forms = new HashMap<String, FormDesc> ();			// A description of each form in the survey
				ArrayList <FormDesc> formList = new ArrayList<FormDesc> ();					// A list of all the forms
				FormDesc topForm = null;
							
				connectionResults = ResultsDataSource.getConnection("surveyKPI-ExportSurvey");
				
				/*
				 * Get the tables / forms in this survey 
				 */
				String sql = null;
				ResultSet resultSet2 = null;
			
				sql = "SELECT f_id, table_name, parentform FROM form" +
						" WHERE s_id = ? " +
						" ORDER BY f_id;";	

				PreparedStatement  pstmt = connectionSD.prepareStatement(sql);	
				pstmt.setInt(1, sId);
				ResultSet resultSet = pstmt.executeQuery();
				
				while (resultSet.next()) {

					FormDesc fd = new FormDesc();
					fd.f_id = resultSet.getString("f_id");
					fd.parent = resultSet.getString("parentform");
					fd.table_name = resultSet.getString("table_name");
					if(inc_id != null) {
						boolean showForm = false;
						boolean setFlat = false;
						int fId = Integer.parseInt(fd.f_id);
						for(int i = 0; i < inc_id.length; i++) {
							if(fId == inc_id[i]) {
								showForm = true;
								setFlat = inc_flat[i];
								break;
							}
						}
						fd.visible = showForm;
						fd.flat = setFlat;
					}
					forms.put(fd.f_id, fd);
					if(fd.parent == null) {
						topForm = fd;
					}
					// Get max records for flat export
					fd.maxRepeats = 1;	// Default
					if(fd.flat && fd.parent != null) {
						fd.maxRepeats = getMaxRepeats(connectionSD, connectionResults, sId, Integer.parseInt(fd.f_id));
					}
				}
				
				/*
				 * Put the forms into a list in top down order
				 */
				formList.add(topForm);		// The top level form
				addChildren(topForm, forms, formList);
					
				/*
				 * Add headers to output buffer 
				 */
				if(csv) {
					if(topForm.visible) {
						qName.append("prikey");
						qText.append("");
					}
				} else {
					outWriter.print("<html xmlns:o=\"urn:schemas-microsoft-com:office:office\" xmlns:x=\"urn:schemas-microsoft-com:office:excel\" xmlns=\"http://www.w3.org/TR/REC-html40\">");
					outWriter.print("<head>");
					outWriter.print("<meta http-equiv=\"Content-Type\" content=\"text/html; charset=UTF-8\">");
					outWriter.print("<meta name=ProgId content=Excel.Sheet>");					// Gridlines
					outWriter.print("<meta name=Generator content=\"Microsoft Excel 11\">");		// Gridlines
					outWriter.print("<title>");
					outWriter.print(filename);
					outWriter.print("</title>");
					
					outWriter.print("<style <!--table @page{} -->>");
					outWriter.print("h1 {text-align:center; font-size: 2em; } ");
					outWriter.print("h2 {font-size: 1.6em; } ");
					outWriter.print("h3 {font-size: 1.2em; } ");
					outWriter.print("table,th,td {border:0.5 } ");
					outWriter.print("table {border-collapse:collapse;} ");
					outWriter.print("td {padding: 5px; } ");
					outWriter.print(".xl1 {mso-number-format:0;} ");										// _device style
					outWriter.print(".xl2 {mso-number-format:\"yyyy\\\\-mm\\\\-dd\\\\ h\\:mm\\:ss\";}");	// Date style

					outWriter.print("</style>");
					outWriter.print("<xml>");							// Gridlines
					outWriter.print("<x:ExcelWorkbook>");
					outWriter.print("<x:ExcelWorksheets>");
					outWriter.print("<x:ExcelWorksheet>");
					outWriter.print("<x:Name>Results Export</x:Name>");
					outWriter.print("<x:WorksheetOptions>");
					outWriter.print("<x:Panes>");
					outWriter.print("</x:Panes>");
					outWriter.print("</x:WorksheetOptions>");
					outWriter.print("</x:ExcelWorksheet>");
					outWriter.print("</x:ExcelWorksheets>");
					outWriter.print("</x:ExcelWorkbook>");
					outWriter.print("</xml>");
					outWriter.print("</head>");
					
					outWriter.print("<body>");
					outWriter.print("<table><thead>");
					if(topForm.visible) {
						qName.append("<tr><th>prikey</th>");
						qText.append("<tr><th></th>");
					}
				}
				
				/*
				 * Add to each form description
				 *  1) The maximum number of repeats (if the form is to be flattened)
				 *  2) The columns that contain the data to be shown
				 */
				for(FormDesc f : formList) {

					
					// Get the question names and identifiers
					sql = "SELECT * FROM " + f.table_name + " LIMIT 1;";
					
					if(pstmt2 != null) {pstmt2.close();};
					pstmt2 = connectionResults.prepareStatement(sql);
					if(resultSet2 != null) {resultSet2.close();};
					resultSet2 = pstmt2.executeQuery();
					ResultSetMetaData rsMetaData2 = resultSet2.getMetaData();
					
					for(int k = 0; k < f.maxRepeats; k++) {
						for(int j = 1; j <= rsMetaData2.getColumnCount(); j++) {
							String name = rsMetaData2.getColumnName(j);
							String type = rsMetaData2.getColumnTypeName(j);
							
							// Ignore the following columns
							if(name.equals("parkey") ||	name.equals("_bad") ||	name.equals("_bad_reason")
									||	name.equals("_task_key") ||	name.equals("_task_replace") ||	name.equals("_modified")
									||	name.equals("_instanceid") ||	name.equals("instanceid")) {
								continue;
							}
							
							// Get the question type
							pstmtQType.setString(1, f.table_name);
							pstmtQType.setString(2, name);
							ResultSet rsType = pstmtQType.executeQuery();
							boolean isAttachment = false;
							boolean isSelectMultiple = false;
							String selectMultipleQuestionName = null;
							String optionName = null;
							if(rsType.next()) {
								String qType = rsType.getString(1);
								boolean ro = rsType.getBoolean(2);
								
								if(!exp_ro && ro) {
									log.info("Dropping readonly: " + name);
									continue;			// Drop read only columns if they are not selected to be exported				
								}
								
								if(qType.equals("image") || qType.equals("audio") || qType.equals("video")) {
									isAttachment = true;
								}
							} else {
								// Possibly a select multiple
								if(name.contains("__")) {
									isSelectMultiple = true;
									selectMultipleQuestionName = name.substring(0, name.indexOf("__"));
									optionName = name.substring(name.indexOf("__") + 2);
								}
							}
							
							
							String colName = name;
							if(isSelectMultiple && merge_select_multiple) {
								colName = selectMultipleQuestionName;
								
								// Add the name of sql column to a look up table for the get data stage
								selMultChoiceNames.put(name, optionName);
							}
							if(f.maxRepeats > 1) {	// Columns need to be repeated horizontally
								colName += "_" + (k + 1);
							}
							if(type.startsWith("timestamp")) {
								colName += " (GMT)";
							}
							
							// If the user has requested that select multiples be merged then we only want the question added once
							boolean skipSelectMultipleOption = false;
							if(isSelectMultiple && merge_select_multiple) {
								String n = selectMultipleColumnNames.get(colName);
								if(n != null) {
									skipSelectMultipleOption = true;
								} else {
									selectMultipleColumnNames.put(colName, colName);
								}
							}
							
							if(!name.equals("prikey") && !skipSelectMultipleOption) {	// Primary key is only added once for all the tables
								if(f.visible) {	// Add column headings if the form is visible
									qName.append(getContent(colName, true,false, colName, type, split_locn));
									if(!language.equals("none")) {
										qText.append(getContent(getQuestion(connectionSD, name, sId, f, language, merge_select_multiple), true, false, name, type, split_locn));
									}
								}
							}
							
							// Set the sql selection text for this column (Only need to do this once, not for every repeating record)
							if(k == 0) {
								
								String selName = null;
								if(type.equals("geometry")) {
									selName = "ST_AsTEXT(" + name + ") ";
								} else if(type.equals("timestamptz")) {	// Return all timestamps at UTC with no time zone
									selName = "timezone('UTC', " + name + ") as " + name;	
								} else {
									
									if(isAttachment) {
										selName = "'" + urlprefix + "' || " + name + " as " + name;
									} else {
										selName = name;
									}
									
								}
								
								if(f.columns == null) {
									f.columns = selName;
								} else {
									f.columns += "," + selName;
								}
								f.columnCount++;
							}
						}
						
						/*
						 * Add the server side calculations
						 */ 
						pstmtSSC.setString(1, f.table_name);
						log.info("sql: " + sqlSSC + " : " + f.table_name);
						resultSet = pstmtSSC.executeQuery();
						while(resultSet.next()) {
							String sscName = resultSet.getString(1);
							String sscFn = resultSet.getString(2);
							String sscType = resultSet.getString(2);
							if(sscType == null) {
								sscType = "decimal";
							}

							String colName = sscName;
							if(sscFn.equals("area")) {
								colName = sscName + " (sqm)";
							} else if (sscFn.equals("length")) {
								colName = sscName + " (m)";
							} else {
								log.info("Invalid SSC function: " + sscFn);
							}
							
							if(f.maxRepeats > 1) {	// Columns need to be repeated horizontally
								colName += "_" + (k + 1);
							}

							if(f.visible) {	// Add column headings if the form is visible
								qName.append(getContent(colName, true,false, colName, sscType, split_locn));
								if(!language.equals("none")) {
									qText.append(getContent(getQuestion(connectionSD, sscName, sId, f, language, merge_select_multiple), true, false, sscName, sscType, split_locn));
								}
							}
							
							
							// Set the sql selection text for this column (Only need to do this once, not for every repeating record)
							if(k == 0) {
								
								String selName = null;
								
								if(sscFn.equals("area")) {
									selName= "ST_Area(geography(the_geom), true) as " + sscName;
								} else if (sscFn.equals("length")) {
									selName= "ST_Length(geography(the_geom), true) as " + sscName;
								} else {
									selName= sscName;
								}
					
								if(f.columns == null) {
									f.columns = selName;
								} else {
									f.columns += "," + selName;
								}
								f.columnCount++;
							}

						}
					}

				}
				if(csv) {
					qName.append("\n");	// Add new line
				} else {
					qName.append("</tr>\n");
				}
				
				if(!language.equals("none")) {	// Add the questions / option labels if requested
					if(csv) {
						qText.append("\n");
					} else {
						qText.append("</tr>\n");
					}
					outWriter.print(qText.toString().replace("&amp;", "&"));	// unescape ampersand for excel
				} 
				outWriter.print(qName.toString());
				if(!csv) {
					outWriter.print("</thead><tbody>");
				}
				
				/*
				 * Add the data
				 */
				getData(connectionResults, outWriter, formList, topForm, flat, split_locn, merge_select_multiple, selMultChoiceNames);
				if(!csv) {
					outWriter.print("</tbody><table></body></html>");
				}
				
				log.info("Content Type:" + response.getContentType());
				log.info("Buffer Size:" + response.getBufferSize());
				log.info("Flushing buffers");
				outWriter.flush(); 
				outWriter.close();
			
			} catch (SQLException e) {
				log.log(Level.SEVERE, "SQL Error", e);
			} catch (Exception e) {
				log.log(Level.SEVERE, "Exception", e);
			} finally {
				
				try {if (pstmt2 != null) {pstmt2.close();	}} catch (SQLException e) {	}
				try {if (pstmtSSC != null) {pstmtSSC.close();	}} catch (SQLException e) {	}
				try {if (pstmtQType != null) {pstmtQType.close();	}} catch (SQLException e) {	}
				
				try {
					if (connectionSD != null) {
						connectionSD.close();
						connectionSD = null;
					}
				} catch (SQLException e) {
					log.log(Level.SEVERE, "Failed to close sd connection", e);
				}
				
				try {
					if (connectionResults != null) {
						connectionResults.close();
						connectionResults = null;
					}
				} catch (SQLException e) {
					log.log(Level.SEVERE, "Failed to close connection", e);
				}
			}
		}
		
	}
	
	private int getMaxRepeats(Connection con, Connection results_con, int sId, int formId)  {
		int maxRepeats = 1;
		
		String sql = "SELECT table_name, parentform FROM form" +
				" WHERE s_id = ? " +
				" AND f_id = ?;";	
		
		PreparedStatement pstmt = null;
		PreparedStatement pstmtGetCount = null;
		try {
			pstmt = con.prepareStatement(sql);
			ArrayList<String> tables = new ArrayList<String> ();
			getTableHierarchy(pstmt, tables, sId, formId);
			int numTables = tables.size();
			
			StringBuffer sqlBuf = new StringBuffer();
			sqlBuf.append("select max(t.cnt)  from " +
					"(select count(");
			sqlBuf.append(tables.get(numTables - 1));
			sqlBuf.append(".prikey) cnt " +
					" from ");
			
			
			for(int i = 0; i < numTables; i++) {
				if(i > 0) {
					sqlBuf.append(",");
				}
				sqlBuf.append(tables.get(i));
			}
			
			// where clause
			sqlBuf.append(" where ");
			sqlBuf.append(tables.get(0));
			sqlBuf.append("._bad='false'");
			if(numTables > 1) {
				for(int i = 0; i < numTables - 1; i++) {
					
					sqlBuf.append(" and ");
					
					sqlBuf.append(tables.get(i));
					sqlBuf.append(".parkey = ");
					sqlBuf.append(tables.get(i+1));
					sqlBuf.append(".prikey");
				}
			}
			
			sqlBuf.append(" group by ");
			sqlBuf.append(tables.get(numTables - 1));
			sqlBuf.append(".prikey) AS t;");
			
			pstmtGetCount = results_con.prepareStatement(sqlBuf.toString());
			ResultSet rsCount = pstmtGetCount.executeQuery();
			if(rsCount.next()) {
				maxRepeats = rsCount.getInt(1);
			}
			
			
			
		} catch (Exception e) {
			e.printStackTrace();
		} finally {
			try {if (pstmt != null) {pstmt.close();	}} catch (SQLException e) {	}
			try {if (pstmtGetCount != null) {pstmtGetCount.close();	}} catch (SQLException e) {	}
		}
		return maxRepeats;
	}
	
	private void getTableHierarchy(PreparedStatement pstmt, ArrayList<String> tables, int sId, int formId) throws SQLException {
		
		pstmt.setInt(1, sId);
		pstmt.setInt(2, formId);
		ResultSet rs = pstmt.executeQuery();
		if(rs.next()) {
			tables.add(rs.getString(1));
			getTableHierarchy(pstmt, tables, sId, rs.getInt(2));
		}
	}
	
	/*
	 * Return the text formatted for html or csv
	 */
	private String getContent(String in, boolean head, boolean firstCol, String columnName,
			String columnType, boolean split_locn) {

		String out = in;
		if(out == null) {
			out = "";
		}
		
		if(csv) {
			if(out.startsWith("//")) {
				out = "https:" + out;
			}
			if(firstCol) {
				out = "\"" + out.replaceAll("\"", "\"\"") + "\"";
			} else {
				out = ",\"" + out.replaceAll("\"", "\"\"") + "\"";
			}
		} else {
			if(head) {
				if(split_locn && columnType != null && columnType.equals("geometry")) {
					// Create two columns for lat and lon
					out = "<th>Latitude</th><th>Longitude</th>";
				} else {
					out = "<th>" + StringEscapeUtils.escapeHtml3(out) + "</th>";
				}
			} else {
				if(split_locn && out.startsWith("POINT")) {

					String coords [] = getLonLat(out);

					if(coords.length > 1) {
							out = "<td>" + coords[1] + "</td><td>" + coords[0] + "</td>"; 
						} else {
							out = "<td>" + StringEscapeUtils.escapeHtml3(out) + "</td><td>" + 
									StringEscapeUtils.escapeHtml3(out) + "</td>";
						}
						
					
				} else if(split_locn && (out.startsWith("POLYGON") || out.startsWith("LINESTRING"))) {
					
					// Can't split linestrings and polygons, leave latitude and longitude as blank
					out= "<td></td><td></td>";
					
				} else if(out.startsWith("POINT")) {
					String coords [] = getLonLat(out);
					if(coords.length > 1) {
					out = "<td>" + "<a href=\"http://www.openstreetmap.org/?mlat=" +
							coords[1] +
							"&mlon=" +
							coords[0] +
							"&zoom=14\">" +
							out + "</a>" + "</td>";
					} else {
						out = "<td>" + StringEscapeUtils.escapeHtml3(out) + "</td>"; 
					}
				} else if(out.startsWith("http")) {
					out = "<td>" + "<a href=\"" + out + "\">" + out + "</a></td>";
				} else if(out.startsWith("//")) {
					out = "<td>" + "<a href=\"https:" + out + "\">https:" + out + "</a></td>";
				} else if(columnName.equals("_device")) {
					out = "<td class='xl1'>" + StringEscapeUtils.escapeHtml3(out) + "</td>";
						
				} else if(columnName.equals("_complete")) {
					out = (out.equals("f")) ? "<td>No</td>" : "<td>Yes</td>"; 
						
				} else if(columnType == "timestamp") {
					// Convert the timestamp to the excel format specified in the xl2 mso-format
					int idx1 = out.indexOf('.');	// Drop the milliseconds
					if(idx1 > 0) {
						out = out.substring(0, idx1);
					} 
					out = "<td class='xl2'>" + StringEscapeUtils.escapeHtml3(out) + "</td>";
				} else {
					out = "<td>" + StringEscapeUtils.escapeHtml3(out) + "</td>";
				}

			}
			
		}
		
		return out;
	}
	
	/*
	 * Get the longitude and latitude from a WKT POINT
	 */
	private String [] getLonLat(String point) {
		String [] coords = null;
		int idx1 = point.indexOf("(");
		int idx2 = point.indexOf(")");
		if(idx2 > idx1) {
			String lonLat = point.substring(idx1 + 1, idx2);
			coords = lonLat.split(" ");
		}
		return coords;
	}
	
	/*
	 * For each record in the top level table all records in other tables that
	 * can link back to the top level record are retrieved.  These are then combined 
	 * to create a tree structure containing the output
	 * 
	 * The function is called recursively until the last table
	 */
	private void getData(Connection connectionResults, PrintWriter outWriter, 
			ArrayList<FormDesc> formList, FormDesc f, boolean flat, boolean split_locn, boolean merge_select_multiple, HashMap<String, String> choiceNames) {
		
		String sql = null;
		PreparedStatement pstmt = null;
		ResultSet resultSet = null;
		ResultSetMetaData rsMetaData = null;
		
		/*
		 * Retrieve the data for this table
		 */
		sql = "SELECT " + f.columns + " FROM " + f.table_name +
				" WHERE _bad IS FALSE";		
		
		if(f.parkey != null) {
			sql += " AND parkey=?";
		}
		sql += " ORDER BY prikey ASC;";	
		
		try {
			pstmt = connectionResults.prepareStatement(sql);
			if(f.parkey != null) {
				pstmt.setInt(1, Integer.parseInt(f.parkey));
			}
			log.info("Get data: " + pstmt.toString());
			resultSet = pstmt.executeQuery();
			rsMetaData = resultSet.getMetaData();
			
			while (resultSet.next()) {

				String prikey = resultSet.getString(1);
				StringBuffer record = new StringBuffer();
				
				// If this is the top level form reset the current parents and add the primary key
				if(f.parkey == null) {
					f.clearRecords();
					record.append(getContent(prikey, false, true, "prikey", "key", split_locn));
				}
				
				
				// Add the other questions to the output record
				String currentSelectMultipleQuestionName = null;
				String multipleChoiceValue = null;
				for(int i = 2; i <= rsMetaData.getColumnCount(); i++) {
											
					String columnName = rsMetaData.getColumnName(i);
					String columnType = rsMetaData.getColumnTypeName(i);
					String value = resultSet.getString(i);
					
					if(value == null) {
						value = "";	
					}
					
					if(merge_select_multiple) {
						String choice = choiceNames.get(columnName);
						if(choice != null) {
							// Have to handle merge of select multiple
							String selectMultipleQuestionName = columnName.substring(0, columnName.indexOf("__"));
							if(currentSelectMultipleQuestionName == null) {
								currentSelectMultipleQuestionName = selectMultipleQuestionName;
								multipleChoiceValue = updateMultipleChoiceValue(value, choice, multipleChoiceValue);
							} else if(currentSelectMultipleQuestionName.equals(selectMultipleQuestionName) && (i != rsMetaData.getColumnCount())) {
								// Continuing on with the same select multiple and its not the end of the record
								multipleChoiceValue = updateMultipleChoiceValue(value, choice, multipleChoiceValue);
							} else if (i == rsMetaData.getColumnCount()) {
								//  Its the end of the record		
								multipleChoiceValue = updateMultipleChoiceValue(value, choice, multipleChoiceValue);
								
								record.append(getContent(multipleChoiceValue, false, false, columnName, columnType, split_locn));
							} else {
								// A second select multiple directly after the first - write out the previous
								record.append(getContent(multipleChoiceValue, false, false, columnName, columnType, split_locn));
								
								// Restart process for the new select multiple
								currentSelectMultipleQuestionName = selectMultipleQuestionName;
								multipleChoiceValue = null;
								multipleChoiceValue = updateMultipleChoiceValue(value, choice, multipleChoiceValue);
							}
						} else {
							if(multipleChoiceValue != null) {
								// Write out the previous multiple choice value before continuing with the non multiple choice value
								record.append(getContent(multipleChoiceValue, false, false, columnName, columnType, split_locn));
								
								// Restart Process
								multipleChoiceValue = null;
								currentSelectMultipleQuestionName = null;
							}
							record.append(getContent(value, false, false, columnName, columnType, split_locn));
						}
					} else {
						record.append(getContent(value, false, false, columnName, columnType, split_locn));
					}
				}
				f.addRecord(prikey, f.parkey, record);
								
				// Process child tables
				if(f.children != null) {
					for(int j = 0; j < f.children.size(); j++) {
						FormDesc nextForm = f.children.get(j);
						nextForm.parkey = prikey;
						getData(connectionResults, outWriter, formList, nextForm, flat, split_locn, merge_select_multiple, choiceNames);
					}
				}
				
				/*
				 * For each complete survey retrieved combine the results
				 *  into a serial list that match the column headers. Where there are missing forms in the
				 *  data, Ie there was no data recorded for a form, then the results are padded
				 *  with empty values.
				 */
				if(f.parkey == null) {
					
					//f.printRecords(4, true);
					
					appendToOutput(outWriter, new StringBuffer(""), formList.get(0), formList, 0, null);
					
				}
			}
			
		} catch (SQLException e) {
			log.log(Level.SEVERE, "SQL Error", e);
		} catch (Exception e) {
			log.log(Level.SEVERE, "Exception", e);
		} finally {
			try{
				if(resultSet != null) {resultSet.close();};
				if(pstmt != null) {pstmt.close();};
			} catch (Exception ex) {
				log.log(Level.SEVERE, "Unable to close resultSet or prepared statement");
			}
		}
		
	}
	
	/*
	 * 
	 */
	String updateMultipleChoiceValue(String dbValue, String choiceName, String currentValue) {
		boolean isSet = false;
		String newValue = currentValue;
		
		if(dbValue.equals("1")) {
			isSet = true;
		}
		
		if(isSet) {
			if(currentValue == null) {
				newValue = choiceName;
			} else {
				newValue += " " + choiceName;
			}
		}
		
		return newValue;
	}
	
	/*
	 * Add the list of children to parent forms
	 */
	private void addChildren(FormDesc parentForm, HashMap<String, FormDesc> forms, ArrayList<FormDesc> formList) {
		
		for(FormDesc fd : forms.values()) {
			if(fd.parent != null && fd.parent.equals(parentForm.f_id)) {
				if(parentForm.children == null) {
					parentForm.children = new ArrayList<FormDesc> ();
				}
				parentForm.children.add(fd);
				formList.add(fd);
				addChildren(fd,  forms, formList);
			}
		}
		
	}
	
	/*
	 * Construct the output
	 */
	private void appendToOutput(PrintWriter outWriter, StringBuffer in, 
			FormDesc f, ArrayList<FormDesc> formList, int index, String parent) {

		int number_records = 0;
		if(f.records != null) {
			number_records = f.records.size(); 
		} 
		
		if(f.visible) {
			
			if(f.flat) {
				StringBuffer newRec = new StringBuffer(in);
				for(int i = 0; i < number_records; i++) {
					newRec.append(f.records.get(i).record);
				}
				
				log.info("flat------>" + f.table_name + "Number records: " + number_records);
				// Pad up to max repeats
				for(int i = number_records; i < f.maxRepeats; i++) {
					StringBuffer record = new StringBuffer();
					for(int j = 1; j < f.columnCount; j++) {	// Start from one to ignore primary key
						record.append(getContent("", false, false, "", "empty", false));
					}
					newRec.append(record);
				}

				if(index < formList.size() - 1) {
					appendToOutput(outWriter, newRec , formList.get(index + 1), 
							formList, index + 1, null);
				} else {
					closeRecord(outWriter, newRec, csv);
				}
				
			} else {
				boolean found_non_matching_record = false;
				boolean hasMatchingRecord = false;
				if(number_records == 0) {
					if(index < formList.size() - 1) {
						
						/*
						 * Add an empty record for this form
						 */
						StringBuffer newRec = new StringBuffer(in);
						for(int j = 1; j < f.columnCount; j++) {	// Start from one to ignore primary key
							newRec.append(getContent("", false, false, "", "empty", false));
						}
						
						FormDesc nextForm = formList.get(index + 1);
						String filter = null;
						
						appendToOutput(outWriter, newRec , nextForm, formList, index + 1, filter);
					} else {
						closeRecord(outWriter, in, csv);
					}
				} else {
					/*
					 * First check all the records to see if there is at least one matching record
					 */
					for(int i = 0; i < number_records; i++) {
						RecordDesc rd = f.records.get(i);
						
						if(parent == null || parent.equals(rd.parkey)) {
							hasMatchingRecord = true;
						}
					}
					
					for(int i = 0; i < number_records; i++) {
						RecordDesc rd = f.records.get(i);
						
						if(parent == null || parent.equals(rd.parkey)) {
							StringBuffer newRec = new StringBuffer(in);
							newRec.append(f.records.get(i).record);
			
							if(index < formList.size() - 1) {
								/*
								 * If the next form is a child of this one then pass the primary key of the current record
								 * to filter the matching child records
								 */
								FormDesc nextForm = formList.get(index + 1);
								String filter = null;
								if(nextForm.parent.equals(f.f_id)) {
									filter = rd.prikey;
								}
								appendToOutput(outWriter, newRec , nextForm, formList, index + 1, filter);
							} else {
								closeRecord(outWriter, newRec, csv);
							} 
						} else {
							/*
							 * Non matching record  Continue processing the other forms in the list once.
							 * This is only done once as multiple non matching records are effectively duplicates
							 * It is also only done if we have not already found a matching record as 
							 *  
							 */
							if(!found_non_matching_record) {
								found_non_matching_record = true;

								if(index < formList.size() - 1) {
									
									/*
									 * Add an empty record for this form
									 */
									StringBuffer newRec = new StringBuffer(in);
									for(int j = 1; j < f.columnCount; j++) {	// Start from one to ignore primary key
										newRec.append(getContent("", false, false, "", "empty", false));
									}
									
									FormDesc nextForm = formList.get(index + 1);
									String filter = null;
									
									appendToOutput(outWriter, newRec , nextForm, formList, index + 1, filter);
								} else {
									/*
									 * Add the record if there are no matching records for this form
									 * This means that if a child form was not completed the main form will still be shown (outer join)
									 */
									if(!hasMatchingRecord) {
										closeRecord(outWriter, in, csv);
									}
								}
							}
						}
					}
				}
			}
		} else {
			log.info("Ignoring invisible form: " + f.table_name);
			// Proceed with any lower level forms
			if(index < formList.size() - 1) {
				appendToOutput(outWriter, in , formList.get(index + 1), 
						formList, index + 1, null);
			} else {
				closeRecord(outWriter, in, csv);
			}
		}
		
	}
	
	/*
	 * Close the record
	 */
	private void closeRecord(PrintWriter outWriter, StringBuffer in, boolean csv) {
		if(!csv) {
			outWriter.print("<tr>");
		}
		outWriter.print(in.toString());
		if(csv) {
			outWriter.print("\n");
		} else {
			outWriter.print("</tr>");
		}
	}
	
	private String getQuestion(Connection conn, String colName, int sId, FormDesc form, String language, boolean merge_select_multiple) throws SQLException {
		String questionText = "";
		String qName = null;
		String oName = null;
		String qType = null;
		PreparedStatement pstmt = null;
		ResultSet resultSet = null;
		int qId = -1;
		
		if(colName != null && language != null) {
			// Split the column name into the question and option part
			// Assume that double underscore is a unique separator
			int idx = colName.indexOf("__");
			if(idx == -1) {
				qName = colName;
			} else {
				qName = colName.substring(0, idx);
				oName = colName.substring(idx+2);
			}
			
			String sql = null;
	
			sql = "SELECT t.value AS qtext, q.qtype AS qtype, q.q_id FROM question q, translation t" +
					" WHERE q.f_id = ? " +
					" AND q.qtext_id = t.text_id " +
					" AND t.language = ? " +
					" AND t.s_id = ? " +
					" AND lower(q.qname) = ?;";

			pstmt = conn.prepareStatement(sql);
			pstmt.setInt(1, Integer.parseInt(form.f_id));
			pstmt.setString(2, language);
			pstmt.setInt(3, sId);
			pstmt.setString(4, qName);
			resultSet = pstmt.executeQuery();
		
			if (resultSet.next()) {
				questionText = resultSet.getString("qtext");
				qType = resultSet.getString("qtype");
				qId = resultSet.getInt("q_id");
			}
			
			// Get any option text
			if(qType != null && qType.startsWith("select")) {
				sql = "SELECT t.value AS otext, o.ovalue AS ovalue FROM option o, question q, translation t" +
						" WHERE q.q_id = ? " +
						" AND o.q_id = q.q_id " +
						" AND o.label_id = t.text_id" +
						" AND t.language = ? " +
						" AND t.s_id = ? " +
						" ORDER BY o.seq ASC;";
						
				pstmt = conn.prepareStatement(sql);	 
				pstmt.setInt(1, qId);
				pstmt.setString(2, language);
				pstmt.setInt(3, sId);
				resultSet = pstmt.executeQuery();
			
				while (resultSet.next()) {
					String name = resultSet.getString("ovalue");
					String label = resultSet.getString("otext");
					if(qType.equals("select1") || merge_select_multiple) {
						// Put all options in the same column
						questionText += " " + name + "=" + label;
					} else if(oName != null) {
						// Only one option in each column
						String cleanName = UtilityMethodsEmail.cleanName(name);
						if(cleanName.equals(oName)) {
							questionText += " " + label;
						}
					}
				}
			}
			
		}
		
		try{
			if(resultSet != null) {resultSet.close();};
			if(pstmt != null) {pstmt.close();};
		} catch (Exception ex) {
			log.log(Level.SEVERE, "Unable to close resultSet or prepared statement");
		}
		
		return questionText;
	}

	/*
	 * Get column information for this table
	 */
	private ArrayList<Column> getTableColumns(Connection conn, FormDesc form) throws SQLException {
		
		ArrayList<Column> columns = null;
		PreparedStatement pstmt = null;
		PreparedStatement pstmtOptions = null;
		ResultSet resultSet = null;
		ResultSet resultSetOptions = null;
		
		String sql = "SELECT qname, qtype, q_id FROM question q" +
				" WHERE f_id = ? " +
				" ORDER BY seq ASC;";
		String sqlOption = "SELECT ovalue, o_id from option o" +
				" WHERE q_id = ?;";

		pstmt = conn.prepareStatement(sql);
		pstmtOptions = conn.prepareStatement(sqlOption);
		
		// Get Questions
		pstmt.setInt(1, Integer.parseInt(form.f_id));
		resultSet = pstmt.executeQuery();
		
		while (resultSet.next()) {
			if(columns == null) {
				columns = new ArrayList<Column> ();
				Column c = null;
				c = new Column();
				c.col_name = "prikey";	// Add default prikey column
				c.q_type = "string";
				columns.add(c);
				c = new Column();		// Add default user column
				c.col_name = "_user";
				c.q_type = "string";
				columns.add(c);
			}
			String q_name = resultSet.getString("qname");
			String q_type = resultSet.getString("qtype");
			int q_id = resultSet.getInt("q_id");
			if(q_type != null && q_type.equals("select")) {
				// Get options
				pstmtOptions.setInt(1, q_id);
				resultSetOptions = pstmtOptions.executeQuery();
				while (resultSetOptions.next()) {
					Column c = new Column();
					columns.add(c);
					
					c.q_name = q_name;
					c.q_type = q_type;
					c.q_id = q_id;
					c.col_name = UtilityMethodsEmail.cleanName(q_name);
					c.o_id = resultSetOptions.getInt("o_id");
					c.o_name = resultSetOptions.getString("ovalue");
					c.col_name = UtilityMethodsEmail.cleanName(q_name) + "__" + UtilityMethodsEmail.cleanName(c.o_name);
				}
			} else {
				Column c = new Column();
				columns.add(c);
				c.q_name = q_name;
				c.q_type = q_type;
				c.q_id = q_id;
				c.col_name = UtilityMethodsEmail.cleanName(q_name);
			}
		
		}
			

			

		
		try{
			if(resultSet != null) {resultSet.close();};
			if(pstmt != null) {pstmt.close();};
		} catch (Exception ex) {
			log.log(Level.SEVERE, "Unable to close resultSet or prepared statement");
		}
		
		return columns;
	}

}
