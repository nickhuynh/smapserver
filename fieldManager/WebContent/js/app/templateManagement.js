/*
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

*/

define(['jquery','jquery_ui', 'localise', 'globals', 'globals', 'tablesorter', 'common', 'rmm'], function($, ui, lang, common, globals) {
	
var	gSurveys,		// Only in this java script file
	gForwards,
	gUpdateFwdPassword,
	gSelectedForward = -1,
	gControlDelete,
	gControlRestore,
	gShowDeleted = false,
	gSelectedTemplate,
	gRemote_host,
	gRemote_user;	
	
$(document).ready(function() {
	
	localise.setlang();		// Localise HTML
	
	/*
	 * Add functionality to control buttons
	 */
	$('#delete_survey').button().click(function () {
		surveyDelete();
	});
	$('#erase_survey').button().click(function () {
		surveyErase();
	});
	$('#un_delete_survey').button().click(function () {
		surveyUnDelete();
	});
	$('#show_deleted').click(function() {
		gShowDeleted = $('#show_deleted').is(':checked');
		completeSurveyList();
	});
	$('#show_deleted').removeAttr('checked');
	
	// Get the user details
	globals.gIsAdministrator = false;
	getLoggedInUser(projectSet, false, true, undefined);

	// Set change function on projects
	$('#project_name').change(function() {
		globals.gCurrentProject = $('#project_name option:selected').val();
		globals.gCurrentSurvey = 1;
		$('#projectId').val(globals.gCurrentProject);		// Set the project value for the hidden field in template upload
		projectSet();
		saveCurrentProject(globals.gCurrentProject, globals.gCurrentSurvey);		// Save the current project id
 	 });
	
	// Forward
	$('#add_forward').button().click(function () {
		edit_forward(undefined);
	});
	
	$('#fwd_host').change(function(){
		var host = $(this).val();
		if(host.length === 0) {
			return false;
		} else if(host.substr(0, 4) !== "http") {
			alert("Protocol (http:// or https:// must be specified with the hostname");
			return false;
		}
	});
	
	$('#fwd_password').change(function(){
		gUpdateFwdPassword = true;
	});
	
	$('#fwd_upd_rem_survey').click(function(){
		getRemoteSurveys();
	});
	
	/*
	 * Style the template editing and uploading
	 */
	$('.abutton').button();
	
	// Forward
	// Initialse the forwarding dialog
	$('#add_forward_popup').dialog(
		{
			autoOpen: false, closeOnEscape:true, draggable:true, modal:true,
			show:"drop",
			title:"Add New Forward",
			width:300,
			height:400,
			zIndex: 2000,
			buttons: [
		        {
		        	text: "Cancel",
		        	click: function() {
		        		
		        		$(this).dialog("close");
		        	}
		        }, {
		        	text: "Save",
		        	click: function(event, ui) {
		        		var forward = {},
		        			forwardString,
		        			error = false,
		        			url,
		        			remote_s_ident,
		        			host,
		        			$dialog;
		        		
		        		remote_s_ident = $('#fwd_rem_survey_id').val();
		        		host = $('#fwd_host').val();
		        		
		        		// Remove any trailing slashes from the host
		        		if(host.substr(-1) == '/') {
		        	        host = host.substr(0, host.length - 1);
		        	    }
		        		
		        		if(typeof remote_s_ident === "undefined" || remote_s_ident.length == 0) {
		        			error = true;
		        			alert("You must select a remote survey");
		        		} else if(host.substr(0, 4) !== "http") {
		        			error = true;
		        			alert("Protocol (http:// or https:// must be specified with the hostname");
		        			$('#fwd_host').focus();
		        		}
		        		
		        		if(!error) {
			        		forward.s_id = gSelectedTemplate;
			        		forward.enabled = true;	
			        		
			        		console.log("update password: " + gUpdateFwdPassword);
			        		forward.enabled = $('#fwd_enabled').is(':checked');
			        		forward.remote_s_ident = remote_s_ident;
			        		forward.remote_s_name = $('#fwd_rem_survey_nm').val();
			        		forward.remote_user = $('#fwd_user').val();	
			        		forward.remote_password = $('#fwd_password').val();
			        		forward.remote_host = host;
			        		forward.update_password = gUpdateFwdPassword;
			        		
			        		if(gSelectedForward !== -1) {
			        			forward.id = gSelectedForward;
			        			url = "/surveyKPI/forwards/update";
			        		} else {
			        			url = "/surveyKPI/forwards/add";
			        			
			        			// Save the values entered by the user
			        			gRemote_host = host;
				        		gRemote_user = $('#fwd_user').val();	
			        		}
			        		
			        		forwardString = JSON.stringify(forward);
			        		$dialog = $(this);
			        		addHourglass();
			        		$.ajax({
			        			  type: "POST",
			        			  contentType: "application/json",
			        			  dataType: "json",
			        			  async: false,
			        			  url: url,
			        			  data: { forward: forwardString },
			        			  success: function(data, status) {
			        				  removeHourglass();
			        				  getForwardsForList(globals.gCurrentProject, gSelectedTemplate);
			        				  $dialog.dialog("close");
			        			  },
			        			  error: function(xhr, textStatus, err) {
		        						removeHourglass();
		        						if(xhr.readyState == 0 || xhr.status == 0) {
		        				              return;  // Not an error
		        						} else {
		        							alert("Error: Failed save forward settings: " + xhr.responseText);
		        						}
		        					}
			        		});
			        	    	
		        		}
		        	}	
		        }
			]
		}
	 );
	
	// Initialse the forwarding dialog
	$('#forward_list_popup').dialog(
		{
			autoOpen: false, closeOnEscape:true, draggable:true, modal:true,
			show:"drop",
			title:"Forward",
			width:'auto',
			height:400,
			zIndex: 2000,
			buttons: [
		        {
		        	text: "Done",
		        	click: function() {
		        		
		        	    $(this).dialog("close");	  
		        	
		        	}	
		        }
			]
		}
	 );
	
	// Initialse the forward select remote survey popup dialog
	$('#select_fwd_survey_pop').dialog(
		{
			autoOpen: false, closeOnEscape:true, draggable:true, modal:true,
			show:"drop",
			title:"Survey Selection",
			width:300,
			height:200,
			zIndex: 2000,
			buttons: [
		        {
		        	text: "Done",
		        	click: function() {
		        		
		        	    $(this).dialog("close");	  
		        	
		        	}	
		        }
			]
		}
	 );
	
	// Initialse the download template dialog
	$('#download_template').dialog(
		{
			autoOpen: false, closeOnEscape:true, draggable:true, modal:true,
			show:"drop",
			title:"Download",
			width:250,
			height:300,
			zIndex: 2000,
			buttons: [
		        {
		        	text: "Cancel",
		        	click: function() {
		        		
		        		$(this).dialog("close");
		        	}
		        }, {
		        	text: "Download",
		        	click: function() {
		        		var docURL,
		        			language,
		        			type;
		        		
		        		type = $("input[name='download_type']:checked", "#download_template").val();
		        		language = $('#download_language option:selected').val();
		        		
		        		docURL = "/surveyKPI/survey/" + gSelectedTemplate + "/download?type=" + type + "&language=" + language;
		        	    
		        	    $(this).dialog("close");	  
		        		window.location.href = docURL;
		        	}	
		        }
			]
		}
	 );
	
	$('#fwd_rem_survey').change(function(){
		remoteSurveyChanged();
	});
	
	// Ident checkbox
	if($('#ident').is(':checked')) {
		$('#surveyIdent').show();
	}
	$('#ident').change(function () {
		$('#surveyIdent').toggle();
	});
	
	// Validate upload form on submit
	// Check that the survey has a valid name
	$('#uploadForm').on("submit", function(e) {
		
		var file = $('#templateName').val(),
			reg_start = /^[a-zA-Z_]+.*/,
			pId = $('#projectId').val();
		
		// Check file name
		if(!reg_start.test(file)) {
			alert("Name must start with a letter or underscore");
			return false;
		} 
		
		// Check for valid project id
		if(pId <= 0) {
			alert("A project must be selected for this survey. You need to have access to at least one project");
			return false;
		}
		
		return true;
	});
	
	enableUserProfile();

});

function remoteSurveyChanged() {
	$('#fwd_rem_survey_id').val($('#fwd_rem_survey :selected').val());
	$('#fwd_rem_survey_nm').val($('#fwd_rem_survey :selected').text());
}

function edit_forward(fwdIndex) {
	
	var forward,
		title = "Add forward";
	
	document.getElementById("fwd_edit_form").reset();
	
	if(fwdIndex) {
		forward = gForwards[fwdIndex];
		console.log("Editing:");
		console.log(forward);
		title = "Edit Forward";
		
		$('#fwd_rem_survey_id').val(forward.remote_s_ident);
		$('#fwd_rem_survey_nm').val(forward.remote_s_name);	
		$('#fwd_user').val(forward.remote_user);	
		// Password not returned from server - leave blank
		
		$('#fwd_host').val(forward.remote_host);
		if(forward.enabled) {
			$('#fwd_enabled').attr('checked','checked');
		} else {
			$('#fwd_enabled').removeAttr('checked');
		}
		gUpdateFwdPassword = false;
		gSelectedForward = forward.id;
	} else {
		$('#fwd_host').val(gRemote_host);	// Set the values to the ones last used
		$('#fwd_user').val(gRemote_user);
		
		$('#fwd_enabled').attr('checked','checked');
		gUpdateFwdPassword = true;
		gSelectedForward = -1;
	}
	$('#add_forward_popup').dialog({title: title}).dialog("open");
}

function projectSet() {
	getSurveysForList(globals.gCurrentProject);			// Get surveys
}

/*
 * Load the surveys from the server and populate the survey table
 */
function getSurveysForList(projectId) {

	if(projectId != -1) {
		var url="/surveyKPI/surveys?projectId=" + projectId + "&blocked=true";
		
		if(globals.gIsAdministrator) {
			url+="&deleted=true";
		}
		
		addHourglass();
		$.ajax({
			url: url,
			dataType: 'json',
			cache: false,
			success: function(data) {
				gSurveys = data;
				completeSurveyList();
				removeHourglass();
			},
			error: function(xhr, textStatus, err) {
				removeHourglass();
				if(xhr.readyState == 0 || xhr.status == 0) {
		              return;  // Not an error
				} else {
					console.log("Error: Failed to get list of surveys: " + err);
				}
			}
		});	
	}
}

/*
 * Forward
 * Load the forwards from the server and populate the forward table
 */
function getForwardsForList(projectId, surveyId) {

	if(projectId != -1) {
		
		function getForwardsForListAsync(sId, pId) {
			var url="/surveyKPI/forwards/" + pId;
			addHourglass();
			$.ajax({
				url: url,
				dataType: 'json',
				cache: false,
				success: function(data) {
					removeHourglass();
					gForwards = data;
					setForwardList(sId);
				},
				error: function(xhr, textStatus, err) {
					removeHourglass();
					if(xhr.readyState == 0 || xhr.status == 0) {
			              return;  // Not an error
					} else {
						console.log("Error: Failed to get list of forwards: " + err);
					}
				}
			});	
		}
		
		getForwardsForListAsync(surveyId, projectId);
	}
}


/*
 * Fill in the survey list
 */
function completeSurveyList() {

	gControlDelete = 0;
	gControlRestore = 0;
	$('#tem_controls').find('button').button("disable");
	
	var $surveys = $('#survey_table'),
	i, survey,
	h = [],
	idx = -1;
	
	h[++idx] = '<table class="tablesorter">';
	h[++idx] = '<thead>';
	h[++idx] = '<tr>';
	h[++idx] = '<th></th>';
	h[++idx] = '<th>Survey Name</th>';
	h[++idx] = '<th>Block</th>';
	h[++idx] = '<th>Download</th>';
	h[++idx] = '<th>Forward</th>';
	h[++idx] = '</tr>';
	h[++idx] = '</thead>';
	h[++idx] = '<tbody>';

	for(i = 0; i < gSurveys.length; i++) {
		survey = gSurveys[i];
		if(gShowDeleted || !survey.deleted) {
			h[++idx] = '<tr';
			if(survey.deleted) {
				h[++idx] = ' class="deleted"';
			} else if(survey.blocked) {
				h[++idx] = ' class="blocked"';
			}
			h[++idx] = '>';
			h[++idx] = '<td class="control_td"><input type="checkbox" name="controls" value="';
			h[++idx] = i;
			h[++idx] = '"></td>';
			h[++idx] = '<td class="displayName">';
			h[++idx] = '<a class="displayName" href="/edit.html?id=';
			h[++idx] = survey.id;
			h[++idx] = '&name=';
			h[++idx] = encodeURI(survey.displayName);
			h[++idx] = '">';
			h[++idx] = survey.displayName;
			h[++idx] = '</a></td>';
			h[++idx] = '<td class="control_block"><input type="checkbox" name="block" value="';
			h[++idx] = survey.id;
			h[++idx] = '" ';
			if(survey.blocked) {
				h[++idx] = 'checked="checked"';
			}
			h[++idx] = '></td>';
			h[++idx] = '<td>';
			h[++idx] = '<button class="pdf_td" type="button" value="';
			h[++idx] = survey.id;
			h[++idx] = '"><img src="images/downarrow.png" height="16" width="16"></button>';
			h[++idx] = '</td>';
			h[++idx] = '<td>';
			h[++idx] = '<button class="forward_td" type="button" value="';
			h[++idx] = survey.id;
			h[++idx] = '"><img src="images/uparrow.png" height="16" width="16"></button>';
			h[++idx] = '</td>';
			h[++idx] = '</tr>';	
		}
	}

	h[++idx] = '</tbody>';
	h[++idx] = '</table>';
	
	$surveys.empty().append(h.join('')).find('table').tablesorter({ widgets: ['zebra'] });
	
	$('.control_td').find('input').click(function() {

		if($(this).is(':checked')) {
			if(gSurveys[$(this).val()].deleted === false) {
				++gControlDelete;
			} else {
				++gControlRestore;
			}

			if(gControlDelete === 1) {
				$('#delete_survey').button("enable");
			}
			if(gControlRestore === 1) {
				$('#un_delete_survey').button("enable");
				$('#erase_survey').button("enable");
			}
		} else {

			if(gSurveys[$(this).val()].deleted === false) {
				--gControlDelete;
			} else {
				--gControlRestore;
			}
			if(gControlDelete === 0) {
				$('#delete_survey').button("disable");
			}
			if(gControlRestore === 0) {
				$('#un_delete_survey').button("disable");
				$('#erase_survey').button("disable");
			}
		}
 
	});
	
	$('.control_block').find('input').click(function() {

		var $template,
			$this = $(this),
			id;
		
		$template = $this.closest('tr');
		id=$this.val();
		
		if($this.is(':checked')) {	
			$template.addClass('blocked');
			executeBlock(id, true);
		} else {
			$template.removeClass('blocked');
			executeBlock(id, false);
		}
 
	});
	
	$('.pdf_td').button().click(function(e) {
		var name;
		
		gSelectedTemplate = $(this).val();
		$.getJSON("/surveyKPI/languages/" + gSelectedTemplate, function(data) {

			var $languageSelect = $('#download_language');
			$languageSelect.empty();
			
			$.each(data, function(j, item) {
				$languageSelect.append('<option value="' + item.name + '">' + item.name + '</option>');
			});
		});
		name = $(this).parent().siblings(".displayName").html();
		$('h1', '#download_template').html(name);
		$('#download_template').dialog("open");
	});
	
	$('.forward_td').button().click(function(e) {
		var selTempName = $(this).parent().siblings('.displayName').html();
		gSelectedTemplate = $(this).val();
		if(typeof gForwards === "undefined") {
			getForwardsForList(globals.gCurrentProject, gSelectedTemplate);	
		} else {
			setForwardList(gSelectedTemplate);
		}
		$('#forward_list_popup h1').html("Local Survey: " + selTempName);
		$('#forward_list_popup').dialog("open");
	});
	
	$('.sEdit').button().click(function(e) {
	});
	
}

/*
 * Fill in the forward list
 * Forward
 */
function setForwardList(sId) {

	console.log("setForwardList: " + sId);
	console.log(gForwards);
	
	var $forwards = $('#forward_table tbody'),
		i, forward,
		h = [],
		idx = -1;

	for(i = 0; i < gForwards.length; i++) {
		forward = gForwards[i];
		if(forward.s_id == sId) {
			h[++idx] = '<tr>';
			h[++idx] = '<td>'; 
			h[++idx] = forward.remote_host;
			h[++idx] = '</td>';
			h[++idx] = '<td>';
			h[++idx] = forward.remote_s_name;
			h[++idx] = '</td>';
			h[++idx] = '<td>';
			h[++idx] = forward.remote_user;
			h[++idx] = '</td>';
			h[++idx] = '<td>';
			h[++idx] = forward.enabled ? 'yes' : 'no';
			h[++idx] = '</td>';	
			h[++idx] = '<td>';
			h[++idx] = '<button class="fwd_edit" type="button" value="';
			h[++idx] = i;
			h[++idx] = '">Edit</button>';
			h[++idx] = '</td>';
			h[++idx] = '<td>';
			h[++idx] = '<button class="fwd_delete" type="button" value="';
			h[++idx] = i;
			h[++idx] = '">Delete</button>';
			h[++idx] = '</td>';
			h[++idx] = '</tr>';	
		}
	}
	
	$forwards.empty().append(h.join(''));
	$('#forward_table').find('table').tablesorter({ widgets: ['zebra']});
	$('.fwd_edit').button().click(function(){
		edit_forward($(this).val());
	});
	$('.fwd_delete').button().click(function(){
		delete_forward($(this).val());
	});
		
}

function delete_forward(index) {
	
	var id = gForwards[index].id;
	
	addHourglass();
	$.ajax({
		  type: "DELETE",
		  contentType: "application/json",
		  dataType: "json",
		  async: false,
		  url: "/surveyKPI/forwards/" + id,
		  success: function(data, status) {
			  removeHourglass();
			  getForwardsForList(globals.gCurrentProject, gSelectedTemplate);
			  alert("Forward Deleted"); 
		  },
		  error: function(xhr, textStatus, err) {
				removeHourglass();
				if(xhr.readyState == 0 || xhr.status == 0) {
		              return;  // Not an error
				} else {
					alert("Error: Failed to delete forward: " + xhr.responseText);
				}
			}
	});
}
/*
 * Update the list of remote survey
 */
function updateRemoteSurveys(surveyList) {

	console.log("updateRemoteSurvey");

	var $rs = $('#fwd_rem_survey'),
		i, survey,
		h = [],
		idx = -1;

	for(i = 0; i < surveyList.length; i++) {
		survey = surveyList[i];
		h[++idx] = '<option value="';
		h[++idx] = survey.formID;
		h[++idx] = '">';
		h[++idx] = survey.name;
		h[++idx] = '</option>';
	}
	
	$rs.empty().append(h.join(''));
	remoteSurveyChanged();
	$('#select_fwd_survey_pop h1').html("Select Remote Survey");
		
}

/*
 * Permanently erase a survey
 */
function surveyErase() {
	
	var surveys = [],
		decision = false,
		h = [],
		i = -1,
		index = 0,
		surveyIdx;
	
	$('.control_td').find('input:checked').each(function() {
		surveyIdx = $(this).val();
		if(gSurveys[surveyIdx].deleted === true) {
			surveys[index++] = {id: gSurveys[surveyIdx].id, name: gSurveys[surveyIdx].displayName};
			h[++i] = gSurveys[surveyIdx].displayName;
		}
	});
	
	decision = confirm("Are you sure you want to permanently erase these surveys and all of their data?\n" + h.join());	
	
	if (decision == true) {
		for(i = 0; i < surveys.length; i++) {
			deleteTemplate(surveys[i].id, surveys[i].name, true);
		}
	}
}

/*
 * Restore soft deleted surveys
 */
function surveyUnDelete() {
	
	var surveys = [],
		decision = false,
		h = [],
		i = -1,
		index = 0;

	$('.control_td').find('input:checked').each(function() {
		var surveyIdx = $(this).val();
		if(gSurveys[surveyIdx].deleted === true) {
			surveys[index++] = {id: gSurveys[surveyIdx].id, name: gSurveys[surveyIdx].displayName};
			h[++i] = gSurveys[surveyIdx].displayName;
		}
	});

	decision = confirm("Are you sure you want to restore these surveys?\n" + h.join());

	if (decision == true) {
		for(i = 0; i < surveys.length; i++) {
			executeUnDelete(surveys[i].id, surveys[i].name);
		}
	}
}

/*
 * Soft delete surveys
 */
function surveyDelete() {
	
	var surveys = [],
		decision = false,
		h = [],
		i = -1,
		index = 0;

	$('.control_td').find(':checked').each(function() {
		var surveyIdx = $(this).val();
		if(gSurveys[surveyIdx].deleted === false) {
			surveys[index++] = {id: gSurveys[surveyIdx].id, name: gSurveys[surveyIdx].displayName};
			h[++i] = gSurveys[surveyIdx].displayName;
		}
	});

	decision = confirm("Are you sure you want to delete these surveys?\n" + h.join());

	if (decision == true) {
		for(i = 0; i < surveys.length; i++) {
			deleteTemplate(surveys[i].id, surveys[i].name, false);
		}
	}
}


function deleteTemplate(template, name, hard) {

	// Check for results associated with this template
	var resultCountURL = "/surveyKPI/survey/" + template + "/getMeta";
	
	if(hard) {
		addHourglass();
		$.ajax({
			type : 'Get',
			url : resultCountURL,
			dataType : 'json',
			cache: false,
			error : function() {
				removeHourglass();
				executeDelete(template, true, hard);	// Just delete as this is what the user has requested

			},
			success : function(response) {
				var totalRows = 0,
					msg, decision;
				
				removeHourglass();
	
				$.each(response.forms, function(index,value) {
					totalRows += value.rows;
				});
				
				if (totalRows == 0) {							
					executeDelete(template, true, hard);	// Delete survey template and data tables
				} else {
					
					msg = "There are " +
						totalRows +
						"data rows submitted for " +
						name +
						". Are you sure you want to delete this data?";
					
					decision = confirm(msg);
					if (decision == true) {
						executeDelete(template, true, hard);
					}
				}
			}
		});
	} else {
		// This is just a soft delete, no need to worry the user about data
		executeDelete(template, true, hard);
	}
}

// Delete the template
function executeDelete(template, delTables, hard) {
	
	var delURL = "/surveyKPI/survey/" + template;

	if(delTables) {
		delURL += "?tables=yes&delData=true&hard=" + hard;
	} else {
		delURL += "?hard=" + hard;
	}
	
	addHourglass();
	$.ajax({
		type : 'DELETE',
		url : delURL,
		error : function() {
			removeHourglass();
			alert("Error: Failed to delete");
		},
		success : function() {
			removeHourglass();
			var projectId = $('#project_name option:selected').val();
			getSurveysForList(projectId);
		}
	});
}

/*
 * Un-Delete the template
 * TODO: Using DELETE to un-delete has to violate innumerable laws of REST!!!!
 * TODO: Presumably the use of DELETE to do a soft delete is also problematic
 */

function executeUnDelete(template) {
	
	var url = "/surveyKPI/survey/" + template + "?undelete=true";
	
	addHourglass();
	$.ajax({
		type : 'DELETE',
		url : url,
		error : function() {
			removeHourglass();
			alert("Error: Failed to restore the survey");
		},
		success : function() {
			var projectId = $('#project_name option:selected').val();
			getSurveysForList(projectId);
			removeHourglass();
		}
	});
}

//Block or ublock the template
function executeBlock(template, set) {
	
	var blockURL = "/surveyKPI/survey/" + template + "/block?set=" + set;
	
	addHourglass();	
	$.ajax({
		type : 'POST',
		url : blockURL,
		error : function() {
			removeHourglass();
			alert("Error: Failed to change block");
		},
		success : function() {
			removeHourglass();
			var projectId = $('#project_name option:selected').val();
			getSurveysForList(projectId);
		}
	});
}

/*
 * Get available surveys from a remote host
 */
function getRemoteSurveys() {
	
	var host,
		user,
		password,
		remote = {},
		remoteString;
	
	remote.address = $('#fwd_host').val();
	remote.user = $('#fwd_user').val();
	remote.password = $('#fwd_password').val();
	
	
	if(!remote.address || remote.address.length == 0) {
		alert("You must specify a remote host");
		$('#fwd_host').focus();
		return;
	} else if(!remote.user || remote.user.length == 0) {
		alert("You must specify a user id to access the remote host");
		$('#fwd_user').focus();
		return;
	} else if(!remote.password || remote.user.password == 0) {
		alert("You must specify a password to access the remote host");
		$('#fwd_password').focus();
		return;
	}
	
	
	$('#select_fwd_survey_pop h1').html("Retrieving survey");
	$('#select_fwd_survey_pop').dialog("open");
	
	remoteString = JSON.stringify(remote);
	addHourglass();
	$.ajax({
		  type: "POST",
		  contentType: "application/json",
		  dataType: "json",
		  async: true,
		  url: "/surveyKPI/forwards/getRemoteSurveys",
		  data: { remote: remoteString },
		  success: function(data, status) {
			  removeHourglass();
			  updateRemoteSurveys(data);
		  },
		  error: function(xhr, textStatus, err) {
				removeHourglass();
				$('#fwd_rem_survey').empty();
				if(xhr.readyState == 0 || xhr.status == 0) {
		              return;  // Not an error
				} else {
					var msg;
					if(xhr.responseText.indexOf("RSA premaster") >= 0) {
						msg = "Remote server does not have a signed certificate, try using http:// instead of https://";
					} else {
						msg = xhr.responseText;
					}
					alert("Error: Failed to get remote surveys: " + msg);
				}
			}
	});

}

});	