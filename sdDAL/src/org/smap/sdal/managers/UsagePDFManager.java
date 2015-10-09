package org.smap.sdal.managers;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.StringReader;
import java.lang.reflect.Type;
import java.net.MalformedURLException;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.logging.Level;
import java.util.logging.Logger;

import javax.servlet.http.HttpServletResponse;

import org.smap.sdal.Utilities.GeneralUtilityMethods;
import org.smap.sdal.model.DisplayItem;
import org.smap.sdal.model.Form;
import org.smap.sdal.model.Label;
import org.smap.sdal.model.Option;
import org.smap.sdal.model.Result;
import org.smap.sdal.model.Row;
import org.smap.sdal.model.User;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import com.itextpdf.text.BadElementException;
import com.itextpdf.text.BaseColor;
import com.itextpdf.text.Chunk;
import com.itextpdf.text.Document;
import com.itextpdf.text.DocumentException;
import com.itextpdf.text.Element;
import com.itextpdf.text.Font;
import com.itextpdf.text.FontFactory;
import com.itextpdf.text.Image;
import com.itextpdf.text.List;
import com.itextpdf.text.ListItem;
import com.itextpdf.text.PageSize;
import com.itextpdf.text.Paragraph;
import com.itextpdf.text.pdf.AcroFields;
import com.itextpdf.text.pdf.AcroFields.Item;
import com.itextpdf.text.pdf.BaseFont;
import com.itextpdf.text.pdf.PdfContentByte;
import com.itextpdf.text.pdf.PdfImportedPage;
import com.itextpdf.text.pdf.PdfPCell;
import com.itextpdf.text.pdf.PdfPTable;
import com.itextpdf.text.pdf.PdfReader;
import com.itextpdf.text.pdf.PdfStamper;
import com.itextpdf.text.pdf.PdfWriter;
import com.itextpdf.text.pdf.PushbuttonField;
import com.itextpdf.tool.xml.ElementList;
import com.itextpdf.tool.xml.XMLWorker;
import com.itextpdf.tool.xml.XMLWorkerHelper;
import com.itextpdf.tool.xml.css.CssFile;
import com.itextpdf.tool.xml.css.StyleAttrCSSResolver;
import com.itextpdf.tool.xml.html.Tags;
import com.itextpdf.tool.xml.parser.XMLParser;
import com.itextpdf.tool.xml.pipeline.css.CSSResolver;
import com.itextpdf.tool.xml.pipeline.css.CssResolverPipeline;
import com.itextpdf.tool.xml.pipeline.end.ElementHandlerPipeline;
import com.itextpdf.tool.xml.pipeline.html.HtmlPipeline;
import com.itextpdf.tool.xml.pipeline.html.HtmlPipelineContext;

/*****************************************************************************

This file is part of SMAP.

SMAP is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

SMAP is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with SMAP.  If not, see <http://www.gnu.org/licenses/>.

 ******************************************************************************/

/*
 * Manage the table that stores details on the forwarding of data onto other systems
 */
public class UsagePDFManager {
	
	private static Logger log =
			 Logger.getLogger(UsagePDFManager.class.getName());
	
	public static Font Symbols = null;
	public static Font defaultFont = null;
	public static BaseColor VLG = new BaseColor(0xE8,0xE8,0xE8);

	/*
	 * Call this function to create a PDF
	 * Return a suggested name for the PDF file derived from the results
	 */
	public void createPdf(
			Connection connectionSD,
			OutputStream outputStream,
			String basePath, 
			HttpServletResponse response,
			int o_id,
			int month,
			int year,
			String period,
			String org_name) {
		
		PreparedStatement pstmt = null;
		
		if(org_name == null) {
			org_name = "None";
		}
		
		try {
			
			String filename;
			
			// Get fonts and embed them
			String os = System.getProperty("os.name");
			log.info("Operating System:" + os);
			
			if(os.startsWith("Mac")) {
				FontFactory.register("/Library/Fonts/fontawesome-webfont.ttf", "Symbols");
				FontFactory.register("/Library/Fonts/Arial Unicode.ttf", "default");
			} else if(os.indexOf("nix") >= 0 || os.indexOf("nux") >= 0 || os.indexOf("aix") > 0) {
				// Linux / Unix
				FontFactory.register("/usr/share/fonts/truetype/fontawesome-webfont.ttf", "Symbols");
				FontFactory.register("/usr/share/fonts/truetype/ttf-dejavu/DejaVuSans.ttf", "default");
			}
			
			Symbols = FontFactory.getFont("Symbols", BaseFont.IDENTITY_H, 
				    BaseFont.EMBEDDED, 12); 
			defaultFont = FontFactory.getFont("default", BaseFont.IDENTITY_H, 
				    BaseFont.EMBEDDED, 10); 
			
			filename = "usage_" + year + "_" + month + ".pdf";	// Todo add org name
			
			/*
			 * Get the usage results
			 */
			String sql = "SELECT users.id as id," +
					"users.ident as ident, " +
					"users.name as name, " +
					"(select count (*) from upload_event ue, subscriber_event se " +
						"where ue.ue_id = se.ue_id " + 
						"and se.status = 'success' " +
						"and se.subscriber = 'results_db' " +
						"and extract(month from upload_time) = ? " + 	// current month
						"and extract(year from upload_time) = ? " + 	// current year
						"and ue.user_name = users.ident) as month, " +
					"(select count (*) from upload_event ue, subscriber_event se " +
						"where ue.ue_id = se.ue_id " +
						"and se.status = 'success'" +
						"and se.subscriber = 'results_db'" +
						"and ue.user_name = users.ident) as all_time " +
					"from users " +	
					"where users.o_id = ? " + 
					"order by users.ident;";
			
			pstmt = connectionSD.prepareStatement(sql);
			pstmt.setInt(1, month);
			pstmt.setInt(2, year);
			pstmt.setInt(3, o_id);
			log.info("Get Usage Data: " + pstmt.toString());

			
			// If the PDF is to be returned in an http response then set the file name now
			if(response != null) {
				log.info("Setting filename to: " + filename);
				setFilenameInResponse(filename, response);
			}
			
			/*
			 * Get a template for the PDF report if it exists
			 * The template name will be the same as the XLS form name but with an extension of pdf
			 */
			String stationaryName = basePath + File.separator + "misc" + File.separator + "UsageReportTemplate.pdf";
			File stationaryFile = new File(stationaryName);
			
			// Margins in points 1/72 
			int marginLeft = 36;
			int marginRight = 36;
			int marginTop = 300;
			int marginBottom = 200;
				
			ByteArrayOutputStream baos = null;
			ByteArrayOutputStream baos_s = null;
			PdfWriter writer = null;
				
				
			/*
			 * Create document in two passes, the second pass adds the letter head
			 */
				
			// Create the underlying document as a byte array
			Document document = new Document(PageSize.A4, marginLeft, marginRight, marginTop, marginBottom);
				
			if(stationaryFile.exists()) {
				baos = new ByteArrayOutputStream();
				baos_s = new ByteArrayOutputStream();
				writer = PdfWriter.getInstance(document, baos);
			} else {
				writer = PdfWriter.getInstance(document, outputStream);
			}
				
			writer.setInitialLeading(12);
			document.open();
			
			// Write the usage data
			ResultSet resultSet = pstmt.executeQuery();
			
			PdfPCell cell = null;
			PdfPTable table = new PdfPTable(4);
			
			// Add the headings
			cell = new PdfPCell(new Paragraph("User Id"));
			cell.setBorderColor(BaseColor.LIGHT_GRAY);
			cell.setBackgroundColor(VLG);
			table.addCell(cell);
			
			cell = new PdfPCell(new Paragraph("User Name"));
			cell.setBorderColor(BaseColor.LIGHT_GRAY);
			cell.setBackgroundColor(VLG);
			table.addCell(cell);
			
			cell = new PdfPCell(new Paragraph("Usage in Period"));
			cell.setBorderColor(BaseColor.LIGHT_GRAY);
			cell.setBackgroundColor(VLG);
			table.addCell(cell);
			
			cell = new PdfPCell(new Paragraph("All Time Usage"));
			cell.setBorderColor(BaseColor.LIGHT_GRAY);
			cell.setBackgroundColor(VLG);
			table.addCell(cell);
			
			// Add the user data
			int total = 0;
			int totalAllTime = 0;
			while(resultSet.next()) {
				String ident = resultSet.getString("ident");
				String name = resultSet.getString("name");
				String monthUsage = resultSet.getString("month");
				int monthUsageInt = resultSet.getInt("month");
				String allTime = resultSet.getString("all_time");
				int allTimeInt = resultSet.getInt("all_time");

				cell = new PdfPCell(new Paragraph(ident));
				cell.setBorderColor(BaseColor.LIGHT_GRAY);
				table.addCell(cell);
				
				cell = new PdfPCell(new Paragraph(name));
				cell.setBorderColor(BaseColor.LIGHT_GRAY);
				table.addCell(cell);
				
				cell = new PdfPCell(new Paragraph(monthUsage));
				cell.setBorderColor(BaseColor.LIGHT_GRAY);
				table.addCell(cell);
				total += monthUsageInt;
				
				cell = new PdfPCell(new Paragraph(allTime));
				cell.setBorderColor(BaseColor.LIGHT_GRAY);
				table.addCell(cell);
				totalAllTime += allTimeInt;
				
			}
			
			// Add the totals
			cell = new PdfPCell(new Paragraph("Totals: "));
			cell.setBorderColor(BaseColor.LIGHT_GRAY);
			cell.setBackgroundColor(VLG);
			table.addCell(cell);
			
			cell = new PdfPCell(new Paragraph(" "));
			cell.setBorderColor(BaseColor.LIGHT_GRAY);
			cell.setBackgroundColor(VLG);
			table.addCell(cell);
			
			cell = new PdfPCell(new Paragraph(String.valueOf(total)));
			cell.setBorderColor(BaseColor.LIGHT_GRAY);
			cell.setBackgroundColor(VLG);
			table.addCell(cell);
			
			cell = new PdfPCell(new Paragraph(String.valueOf(totalAllTime)));
			cell.setBorderColor(BaseColor.LIGHT_GRAY);
			cell.setBackgroundColor(VLG);
			table.addCell(cell);
			
			document.add(table);
			document.close();
				
			if(stationaryFile.exists()) {
					
				// Step 2 - Populate the fields in the stationary
				PdfReader s_reader = new PdfReader(stationaryName);
				PdfStamper s_stamper = new PdfStamper(s_reader, baos_s);
				AcroFields pdfForm = s_stamper.getAcroFields();
				Set<String> fields = pdfForm.getFields().keySet();
				for(String key: fields) {
					System.out.println("Field: " + key);
				}
					
				pdfForm.setField("billing_period", period);
				pdfForm.setField("organisation", org_name);
				
				s_stamper.setFormFlattening(true);
				s_stamper.close();
				
				// Step 3 - Apply the stationary to the underlying document
				PdfReader reader = new PdfReader(baos.toByteArray());		// Underlying document
				PdfReader f_reader = new PdfReader(baos_s.toByteArray());	// Filled in stationary
				PdfStamper stamper = new PdfStamper(reader, outputStream);
				PdfImportedPage letter1 = stamper.getImportedPage(f_reader, 1);
				int n = reader.getNumberOfPages();
				PdfContentByte background;
				for(int i = 0; i < n; i++ ) {
					background = stamper.getUnderContent(i + 1);
					background.addTemplate(letter1, 0, 0);
				}
		
				stamper.close();
				reader.close();
				
			}
			
			
		} catch (SQLException e) {
			log.log(Level.SEVERE, "SQL Error", e);
			
		}  catch (Exception e) {
			log.log(Level.SEVERE, "Exception", e);
			
		}  finally {
			try {if (pstmt != null) {pstmt.close();	}} catch (SQLException e) {	}
		}

	
	}
	
	/*
	 * Add the filename to the response
	 */
	private void setFilenameInResponse(String filename, HttpServletResponse response) {

		String escapedFileName = null;
		
		log.info("Setting filename in response: " + filename);
		if(filename == null) {
			filename = "survey";
		}
		try {
			escapedFileName = URLDecoder.decode(filename, "UTF-8");
			escapedFileName = URLEncoder.encode(escapedFileName, "UTF-8");
		} catch (Exception e) {
			log.log(Level.SEVERE, "Encoding Filename Error", e);
		}
		escapedFileName = escapedFileName.replace("+", " "); // Spaces ok for file name within quotes
		escapedFileName = escapedFileName.replace("%2C", ","); // Commas ok for file name within quotes
		
		response.setHeader("Content-Disposition", "attachment; filename=\"" + escapedFileName +"\"");	
		response.setStatus(HttpServletResponse.SC_OK);	
	}

}


