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

var gWait = 0;		// This javascript file only

/* 
 * ==============================================================
 * Task Functions
 * ==============================================================
 */

function addPendingTask(taskId, assignmentId, status, source) {
	var i,
		duplicate = false,
		assignment;
	
	assignment = {
			assignment_id: assignmentId,
			assignment_status: status,
			task_id: taskId			
			};
	globals.gPendingUpdates.push(assignment);
	
	if(source === "table") {
		updateMapTaskSelections(taskId, true);
	} else if(source === "map") {
		$('#tasks_table').find('[data-taskid=' + taskId + ']').prop("checked", true).closest('tr').addClass("info");
	}
}

function removePendingTask(taskId, source) {
	var i;
	for (i = 0; i < globals.gPendingUpdates.length; i++) {
		if(globals.gPendingUpdates[i].task_id === taskId) {
			globals.gPendingUpdates.splice(i,1);
			break;
		}
	}
	if(source === "table") {
		updateMapTaskSelections(taskId, false);
	} else if(source === "map") {
		$('#tasks_table').find('[data-taskid=' + taskId + ']').prop("checked", false).closest('tr').removeClass("info");
	}
}

/*
 * ===============================================================
 * Project Functions
 * ===============================================================
 */

/*
 * Update the list of available projects
 */
function updateProjectList(addAll, projectId, callback) {

	var $projectSelect = $('.project_list'),
		i, 
		h = [],
		idx = -1,
		updateCurrentProject = true;
	
	if(addAll) {
		h[++idx] = '<option value="0">All</option>';
		updateCurrentProject = false;
	}
	for(i = 0; i < globals.gProjectList.length; i++) {
		h[++idx] = '<option value="';
		h[++idx] = globals.gProjectList[i].id;
		h[++idx] = '">';
		h[++idx] = globals.gProjectList[i].name;
		h[++idx] = '</option>';
		
		if(globals.gProjectList[i].id === projectId) {
			updateCurrentProject = false;
		}
	}
	$projectSelect.empty().append(h.join(''));

	// If for some reason the user's default project is no longer available then 
	//  set the default project to the first project in the list
	//  if the list is empty then set the default project to undefined
	if(updateCurrentProject && globals.gProjectList[0]) {	
		globals.gCurrentProject = globals.gProjectList[0].id;		// Update the current project id
		globals.gCurrentSurvey = -1;
		saveCurrentProject(globals.gCurrentProject, globals.gCurrentSurvey);	// Save the current project id
	} else if(updateCurrentProject) {	
		globals.gCurrentProject = -1;		// Update the current project id
		globals.gCurrentSurvey = -1;
		saveCurrentProject(globals.gCurrentProject, globals.gCurrentSurvey);	// Save the current project id
	}
	
	$projectSelect.val(globals.gCurrentProject);			// Set the initial project value
	$('#projectId').val(globals.gCurrentProject);			// Set the project value for the hidden field in template upload

	if(typeof callback !== "undefined") {
		callback(globals.gCurrentProject);				// Call the callback with the correct current project
	}
}

/*
 * Get the list of available projects from the server
 */
function getMyProjects(projectId, callback, getAll) {
	addHourglass();
	$.ajax({
		url: "/surveyKPI/myProjectList",
		dataType: 'json',
		cache: false,
		success: function(data) {
			removeHourglass();
			globals.gProjectList = data;
			updateProjectList(getAll, projectId, callback);
		},
		error: function(xhr, textStatus, err) {
			removeHourglass();
			if(xhr.readyState == 0 || xhr.status == 0) {
	              return;  // Not an error
			} else {
				alert("Error: Failed to get list of projects: " + err);
			}
		}
	});	
}

/*
 * Save the current project id in the user defaults
 */
function saveCurrentProject(projectId, surveyId) {

	if(surveyId > 0 || projectId > 0) {
		
		var user = {
				current_project_id: projectId,
				current_survey_id: surveyId
				};
		var userString = JSON.stringify(user);
		
		addHourglass();
		$.ajax({
			  type: "POST",
			  contentType: "application/json",
			  dataType: "json",
			  url: "/surveyKPI/user",
			  data: { user: userString },
			  success: function(data, status) {
				  removeHourglass();
			  }, error: function(data, status) {
				  removeHourglass();
				  console.log("Error: Failed to save current project");
			  }
		});
	}
}


/*
 * ===============================================================
 * User Functions
 * ===============================================================
 */

/*
 * Update the user details on the page
 */
function updateUserDetails(data, getOrganisationsFn) {
	
	var groups = data.groups,
		i,
		bootstrap_enabled = (typeof $().modal == 'function');
	
	if(data.language && data.language !== gUserLocale) {
		localStorage.setItem('user_locale', data.language);
		location.reload();
	}
	globals.gLoggedInUser = data;
	
	if(bootstrap_enabled) {

			
		$('#modify_me_popup').on('show.bs.modal', function (event) {
			  var $this = $(this)
			  $this.find('.modal-title').text(data.ident + "@" + data.organisation_name)
			  
			  $('#me_edit_form')[0].reset();
			  $('#reset_me_password_fields').show();
			  $('#password_me_fields').hide();
			  addLanguageOptions($('#me_language'), data.language);
			  $('#me_name').val(data.name);
			  $('#me_email').val(data.email);
				
			  $(".navbar-collapse").removeClass("in").addClass("collapse");	// Remove drop down menu
			});

		
	} else {
		$('#username').html(data.name).button({ label: data.name + " @" + data.organisation_name, 
				icons: { primary: "ui-icon-person" }}).off().click(function(){
			$('#me_edit_form')[0].reset();
			
			$('#reset_me_password_fields').show();
			$('#password_me_fields').hide();
			addLanguageOptions($('#me_language'), data.language);
			$('#me_name').val(data.name);
			$('#me_email').val(data.email);
			
			$('#modify_me_popup').dialog("option", "title", data.name + "@" + data.organisation_name);
			$('#modify_me_popup').dialog("open");
		});
	}
	
	/*
	 * Show administrator only functions
	 */
	if(groups) {
		for(i = 0; i < groups.length; i++) {
			if(groups[i].name === "admin") {
				globals.gIsAdministrator = true;
			}
			if(groups[i].name === "org admin") {
				globals.gIsOrgAdministrator = true;
			}
			if(groups[i].name === "analyst") {
				globals.gIsAnalyst = true;
			}
		}
	}
	
	// Only show items relevant to a user
	$('.restrict_role').hide();
	if(globals.gIsAnalyst) {
		$('.analyst_role').show();
	} 
	if(globals.gIsAdministrator) {
		$('.admin_role').show();
	} 
	if(globals.gIsOrgAdministrator) {
		$('.org_role').show();
		if(typeof getOrganisationsFn === "function") {
			getOrganisationsFn();
		}
	} 
	
	// Other conditional elements
	if(!globals.gSendTrail) {
		$('.user_trail').hide();
	}
	// 	Customer configurable details - the configurable part is TODO
	$('#my_name').val(data.name);			// Add the name to the configurable list
	
	if(data.settings) {
		var userDetails = JSON.parse(data.settings);
		$('#my_title').val(userDetails.title);
		$('#my_license').val(userDetails.license);
		$('#my_signature').attr("src", data.signature);
	}
}

function addLanguageOptions($elem, current) {
	
	var h = [],
		idx = -1,
		i,
		languages = [
		             {
		            	locale: "en",
		            	name: "English"
		             },
		             {
			            locale: "fr",
			            name: "French"
			         },
			         {
				         	locale: "hi",
				            name: "Hindi"
						 },
			         {
			         	locale: "pt",
			            name: "Portugese"
					 },
			         {
				        locale: "es",
				        name: "Spanish"
			         }
		];
	
	for(i = 0; i < languages.length; i++) {
		h[++idx] = '<option value="';
		h[++idx] = languages[i].locale;
		h[++idx] = '">';
		h[++idx] = languages[i].name;
		h[++idx] = '</option>';
	}
	$elem.html(h.join(''));
	$elem.val(current);
}

/*
 * Enable the user profile button
 */
function enableUserProfile () {
	 // Initialise the dialog for the user to edit their own account details
	 $('#modify_me_popup').dialog(
		{
			autoOpen: false, closeOnEscape:true, draggable:true, modal:true,
			title:"User Profile",
			show:"drop",
			width:350,
			height:350,
			zIndex: 2000,
			buttons: [
		        {
		        	text: "Cancel",
		        	click: function() {
		        		
		        		$(this).dialog("close");
		        	}
		        }, {
		        	text: "Save",
		        	click: function() {

		        		var user = globals.gLoggedInUser,
		        			userList = [],
		        			error = false,
		        			userList;
		        		
		        		user.name = $('#me_name').val();
		        		user.language = $('#me_language').val();
		        		user.email = $('#me_email').val();
		        		if($('#me_password').is(':visible')) {
		        			user.password = $('#me_password').val();
		        			if($('#me_password_confirm').val() !== user.password) {
		        				error = true;
		        				user.password = undefined;
		        				alert("Passwords do not match");
		        				$('#me_password').focus();
		        				return false;
		        			}
		        		} else {
		        			user.password = undefined;
		        		}
		        		
		        		user.current_project_id = 0;	// Tell service to ignore project id and update other details
		        		user.current_survey_id = 0;
		        		saveCurrentUser(user);			// Save the updated user details to disk
		        		$(this).dialog("close");
		        	}, 
		        }, {
		        	text: "Logout",
		        	click: function() {
		        		// Call logout function
		        		jQuery.ajax({
		        		    type: "GET",
		        			cache: false,
		        		    url: "/surveyKPI/logout",
		        		    error: function(data, status) {
		        				  window.location.href="/";
		        			},
		        			success: function(data,status) {
		        				window.location.href="/";
		        			}
		        		});
		        		
		        		// For firefox need to do an invalid logon to logout
		        		jQuery.ajax({
		        		    type: "GET",
		        			cache: false,
		        		    url: "/fieldManager/templateManagement.html",
		        		    username: "shkdhasfkhd",
		        		    password: "sieinkdnfkdf"
		        		});
		        	
		        		/*
		        		jQuery.ajax({
		        		    type: "GET",
		        			cache: false,
		        		    url: "/fieldManager/templateManagement.html",
		        		    username: "shkdhasfkhd",
		        		    password: "sieinkdnfkdf",
		        		    error: function(data, status) {
		        				  window.location.href="/";
		        			},
		        			success: function(data,status) {
		        				window.location.href="/";
		        			}
		        		});
		        		*/
		        		$(this).dialog("close");
		        		
		        	}
		        	
		        }
			]
		}
	 );
	 

	 // Initialise the reset password checkbox
	 $('#reset_me_password').click(function () {
		 if($(this).is(':checked')) {
			 $('#password_me_fields').show();
		 } else {
			 $('#password_me_fields').hide();
		 }
	 });
}

/*
 * Enable the user profile button
 */
function enableUserProfileBS () {
	

	/*
	 * User logout
	 */
	$('#userProfileLogout').click(function() {
		
		// Call logout function
		jQuery.ajax({
		    type: "GET",
			cache: false,
		    url: "/surveyKPI/logout",
		    error: function(data, status) {
				  window.location.href="/";
			},
			success: function(data,status) {
				window.location.href="/";
			}
		});
		
		// For firefox need to do an invalid logon to logout
		jQuery.ajax({
		    type: "GET",
			cache: false,
		    url: "/fieldManager/templateManagement.html",
		    username: "shkdhasfkhd",
		    password: "sieinkdnfkdf"
		});
	});
	
	/*
	 * Save the user profile
	 */
	$('#userProfileSave').click(function() {
		var user = globals.gLoggedInUser,
		userList = [],
		error = false,
		userList;
		
		user.name = $('#me_name').val();
		user.language = $('#me_language').val();
		user.email = $('#me_email').val();
		if($('#me_password').is(':visible')) {
			user.password = $('#me_password').val();
			if($('#me_password_confirm').val() !== user.password) {
				error = true;
				user.password = undefined;
				alert("Passwords do not match");
				$('#me_password').focus();
				return false;
			}
		} else {
			user.password = undefined;
		}
		
		user.current_project_id = 0;	// Tell service to ignore project id and update other details
		user.current_survey_id = 0;
		saveCurrentUser(user);			// Save the updated user details to disk	 
	});

	
	 // Initialise the reset password checkbox
	 $('#reset_me_password').click(function () {
		 if($(this).is(':checked')) {
			 $('#password_me_fields').show();
		 } else {
			 $('#password_me_fields').hide();
		 }
	 });
}

/*
 * Save the currently logged on user's details
 */
function saveCurrentUser(user) {

	var userString = JSON.stringify(user);
	addHourglass();
	$.ajax({
		  type: "POST",
		  contentType: "application/json",
		  dataType: "json",
		  url: "/surveyKPI/user",
		  data: { user: userString },
		  success: function(data, status) {
			  removeHourglass();
			  updateUserDetails(user, undefined);
		  }, error: function(data, status) {
			  removeHourglass();
			  alert("Error profile not saved"); 
		  }
	});
}


function getLoggedInUser(callback, getAll, getProjects, getOrganisationsFn, hideUserDetails, dontGetCurrentSurvey) {
	addHourglass();
	$.ajax({
		url: "/surveyKPI/user",
		cache: false,
		dataType: 'json',
		success: function(data) {
			removeHourglass();
		
			globals.gServerCanSendEmail = data.sendEmail;
			
			globals.gEmailEnabled = data.allow_email;
			globals.gFacebookEnabled = data.allow_facebook;
			globals.gTwitterEnabled = data.allow_twitter;
			globals.gCanEdit = data.can_edit;
			globals.gSendTrail = data.ft_send_trail;
			
			if(!hideUserDetails) {
				updateUserDetails(data, getOrganisationsFn);
			}
			
			if(!dontGetCurrentSurvey) {	// Hack, on edit screen current survey is set as parameter not from the user's defaults
				globals.gCurrentSurvey = data.current_survey_id;
			}
			globals.gCurrentProject = data.current_project_id;
			$('#projectId').val(globals.gCurrentProject);		// Set the project value for the hidden field in template upload
			
			if(getProjects) {
				getMyProjects(globals.gCurrentProject, callback, getAll);	// Get projects 
			} else {
				if(typeof callback !== "undefined") {
					callback(globals.gCurrentSurvey);				// Call the callback with the correct current project
				}
			}

		},
		error: function(xhr, textStatus, err) {
			removeHourglass();
			if(xhr.readyState == 0 || xhr.status == 0) {
	              return;  // Not an error
			} else {
				console.log("Error: Failed to get user details: " + err);
				alert("Error: Failed to get user details: " + err);
			}
		}
	});	
}

/*
 * ===============================================================
 * Common functions for managing media (on both the edit page and shared resource page)
 * ===============================================================
 */

/*
 * Upload files to the server
 * Writes status to   #upload_msg
 */
function uploadFiles(url, formName, callback, sId) {
   	
	var f = document.forms.namedItem(formName),
		formData = new FormData(f);
	
	addHourglass();
    $.ajax({
        url: url,
        type: 'POST',
        xhr: function () {
        	var myXhr = $.ajaxSettings.xhr();
    		if(myXhr.upload){ 
    			myXhr.upload.addEventListener('progress', progressFn, false); 
    		}
    		return myXhr;
        },
        data: formData,
        cache: false,
        contentType: false,
        processData:false,
        success: function(data) {
			removeHourglass();
			var surveyId = sId;
        	callback(data, surveyId);
        	$('#upload_msg').removeClass('alert-danger').addClass('alert-success').html("Upload Success");
        	document.forms.namedItem(formName).reset();
        	
        },
        error: function(xhr, textStatus, err) {
			removeHourglass();
				if(xhr.readyState == 0 || xhr.status == 0) {
	              return;  // Not an error
			} else {
				$('#upload_msg').removeClass('alert-success').addClass('alert-danger').html("Upload failed: " + err);

			}
        }
    });
}

/*
 * Progress function for the uploading of files
 */
function progressFn(e) {
	if(e.lengthComputable){
        var w = (100.0 * e.loaded) / e.total;
        $('.progress-bar').css('width', w+'%').attr('aria-valuenow', w); 
    }
}

/*
 * Refresh the view of any attached media if the available media items has changed
 */
function refreshMediaView(data, sId) {
	
	var i,
		survey = globals.model.survey,
		$element,
		h = [],
		idx = -1,
		files;
	
	if(survey && sId) {
		// Set the display name
		$('.formName').html(survey.displayName);
		$('#survey_id').val(sId);
		gSId = sId;
	}
	
	if(data) {
		files = data.files;
		
		if(sId) {
			$element = $('#filesSurvey');
		} else {
			$element = $('#filesOrg');
		}
		
		for(i = 0; i < files.length; i++){
			h[++idx] = '<tr class="';
			h[++idx] = files[i].type;
			h[++idx] = '">';
			h[++idx] = '<td class="preview">';
			h[++idx] = '<a target="_blank" href="';
			h[++idx] = files[i].url;
			h[++idx] = '">';
			if(files[i].type == "audio") {
				h[++idx] = addAudioIcon();
			} else if(files[i].type == "geojson") {
				h[++idx] = addVectorMapIcon();
			} else {
				h[++idx] = '<img src="';
				h[++idx] = files[i].thumbnailUrl;
				h[++idx] = '" alt="';
				h[++idx] = files[i].name;
				h[++idx] = '">';
			}
			h[++idx] = '</a>';
			h[++idx] = '</td>';
			h[++idx] = '<td class="filename">';
				h[++idx] = '<p>';
				h[++idx] = files[i].name;
				h[++idx] = '</p>';
			h[++idx] = '</td>';
			h[++idx] = '<td class="mediaManage">';
				h[++idx] = '<p>';
				h[++idx] = files[i].size;
				h[++idx] = '</p>';
			h[++idx] = '</td>';
			h[++idx] = '<td class="mediaManage">';
				h[++idx] = '<button class="media_del btn btn-danger" data-url="';
				h[++idx] = files[i].deleteUrl;
				h[++idx] = '">';
				h[++idx] = '<span class="glyphicon glyphicon-trash" aria-hidden="true"></span>'
				h[++idx] = ' Delete';
				h[++idx] = '</button>';
			h[++idx] = '</td>';
			h[++idx] = '<td class="mediaSelect">';
				h[++idx] = '<button class="mediaAdd btn btn-success">';
				h[++idx] = '<span class="glyphicon glyphicon-plus" aria-hidden="true"></span>'
					h[++idx] = ' Add';
				h[++idx] = '</button>';
			h[++idx] = '</td>';
			
			
			h[++idx] = '</tr>';
			
		}
		

		$element.html(h.join(""));
	
		$('.media_del', $element).click(function () {
			var surveyId = sId,
				url = $(this).data('url'),
				idx = url.lastIndexOf('/'),
				filename = url.substring(idx + 1);
			
			if(confirm(localise.set["msg_confirm_del"] + filename)) {
				delete_media(url, surveyId);
			}
		});
	
	}	
	
	// If this is the organisational view we can refresh the list of chocies for selecting vector maps
	if(!sId) {
		refreshVectorSelects(data);
	}
}

/*
 * Refresh the vector select lists
 */
function refreshVectorSelects(data) {
	
	var i,
		$vectorData = $('#vector_data'),
		$vectorStyle = $('#vector_style'),
		h_d = [],
		idx_d = -1,
		h_s = [],
		idx_s = -1,
		files;
	
	if(data) {
		files = data.files;
		
		for(i = 0; i < files.length; i++){
			if(files[i].type === "geojson") {
				h_d[++idx_d] = '<option value="';
				h_d[++idx_d] = files[i].name;
				h_d[++idx_d] = '">';
				h_d[++idx_d] = files[i].name;
				h_d[++idx_d] = '</option>';
			}
			
			if(files[i].type === "TODO") {
				h_s[++idx_s] = '<option value="';
				h_s[++idx_s] = files[i].name;
				h_s[++idx_s] = '">';
				h_s[++idx_s] = files[i].name;
				h_s[++idx_s] = '</option>';
			}	
			
		}
		

		$vectorData.html(h_d.join(""));
		$vectorStyle.html(h_s.join(""));
	
	
	}	
}

function addAudioIcon() {
	var h = [],
		idx = -1;

	h[++idx] = '<span class="question_type has_tt" title="Audio">';
	h[++idx] = '<span class="glyphicon glyphicon-volume-up edit_type"></span>';
	h[++idx] = '</span>';
	
	return h.join('');
}

function addVectorMapIcon() {
	var h = [],
		idx = -1;

	h[++idx] = '<span class="question_type has_tt" title="Audio">';
	h[++idx] = '<span class="glyphicon glyphicon glyphicon-map-marker edit_type"></span>';
	h[++idx] = '</span>';
	
	return h.join('');
}

function getFilesFromServer(url, sId, callback) {
	
	if(sId) {
		gSId = sId;
		url += '?sId=' + sId;
	}
	
	addHourglass();
	$.ajax({
		url: url,
		dataType: 'json',
		cache: false,
		success: function(data) {
			removeHourglass();
			var surveyId = sId;
			callback(data, surveyId);

		},
		error: function(xhr, textStatus, err) {
			removeHourglass();
			if(xhr.readyState == 0 || xhr.status == 0) {
	              return;  // Not an error
			} else {
				$('#upload_msg').removeClass('alert-success').addClass('alert-danger').html("Error: " + err);
			}
		}
	});	
}

/*
 * Delete a media file
 */
function delete_media(url, sId) {
	addHourglass();
	$.ajax({
		url: url,
		type: 'DELETE',
		cache: false,
		success: function(data) {
			removeHourglass();
			var surveyId = sId;
			refreshMediaView(data, surveyId);
	
		},
		error: function(xhr, textStatus, err) {
			removeHourglass();
			if(xhr.readyState == 0 || xhr.status == 0) {
	              return;  // Not an error
			} else {
				$('#upload_msg').removeClass('alert-success').addClass('alert-danger').html("Error: " + err);
			}
		}
	});	
	
}
/*
 * ===============================================================
 * Hourglass Functions
 * ===============================================================
 */

function addHourglass() {

	if(gWait === 0) {

		$("#hour_glass").show();
	}
	++gWait;
}

function removeHourglass() {

	--gWait;
	if(gWait === 0) {

		$("#hour_glass").hide();
	}

}

/*
 * ===============================================================
 * Survey Functions
 * ===============================================================
 */

/*
 * Load the surveys from the server
 */
function loadSurveys(projectId, selector, getDeleted, addAll, callback) {
	
	var url="/surveyKPI/surveys?projectId=" + projectId + "&blocked=true",
		$elem;
	
	if(selector === undefined) {
		selector = ".survey_select";	// Update the entire class of survey select controls
	}
	$elem = $(selector);
	
	if(typeof projectId !== "undefined" && projectId != -1 && projectId != 0) {
		
		if(getDeleted) {
			url+="&deleted=true";
		}
		addHourglass();

		$.ajax({
			url: url,
			dataType: 'json',
			cache: false,
			success: function(data) {
				
				removeHourglass();
				$elem.empty();
				if(addAll) {
					$elem.append('<option value="_all">All Surveys</option>');	
				}
				$.each(data, function(j, item) {
					$elem.append('<option value="' + item.id + '">' + item.displayName + '</option>');
				});

				//globals.gCurrentSurvey = $elem.val();   // TODO set to current global survey
				if(globals.gCurrentSurvey > 0) {
					$elem.val(globals.gCurrentSurvey);
				}
				
				if(typeof callback == "function") {
					callback();
				}
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
	} else {
		$elem.empty();
		if(addAll) {
			$elem.append('<option value="_all">All Surveys</option>');	
		}
		
		if(callback) {
			callback();
		}

	}
}

// Common Function to get the language and question list (for the default language)
function getLanguageList(sId, callback, addNone, selector, setGroupList) {
	
	if(typeof sId === "undefined") {
		sId = globals.gCurrentSurvey;
	}
	
	function getAsyncLanguageList(sId, theCallback, selector) {
		addHourglass();
		$.ajax({
			url: languageListUrl(sId),
			dataType: 'json',
			cache: false,
			success: function(data) {
				removeHourglass();
				globals.gSelector.setSurveyLanguages(sId, data);
				if(selector) {
					setSurveyViewLanguages(data, undefined, selector, addNone);
				} else {
					setSurveyViewLanguages(data, undefined, '#settings_language', false);	
					setSurveyViewLanguages(data, undefined, '#export_language', true);
					setSurveyViewLanguages(data, undefined, '#language_name', false);
				}
				
				if(data[0]) {
					getQuestionList(sId, data[0].name, "-1", "-1", theCallback, setGroupList, undefined);	// Default language to the first in the list
				} else {
					if(typeof theCallback === "function") {
						theCallback();
					}
				}
				
			},
			error: function(xhr, textStatus, err) {
				removeHourglass();
				if(xhr.readyState == 0 || xhr.status == 0) {
		              return;  // Not an error
				} else {
					alert("Error: Failed to get list of languages: " + err);
				}
			}
		});	
	}
	
	getAsyncLanguageList(sId, callback, selector);
}

//Function to get the question list
function getQuestionList(sId, language, qId, groupId, callback, setGroupList, view) {

	function getAsyncQuestionList(sId, language, theCallback, groupId, qId, view) {
	
		addHourglass();
		$.ajax({
			url: questionListUrl(sId, language, true),
			dataType: 'json',
			cache: false,
			success: function(data) {
				removeHourglass();
				globals.gSelector.setSurveyQuestions(sId, language, data);
				setSurveyViewQuestions(data, qId, view);
	
				if(setGroupList && typeof setSurveyViewQuestionGroups === "function") {
					setSurveyViewQuestionGroups(data, groupId);
				}
				if(typeof theCallback === "function") {
					theCallback();
				}
			},
			error: function(xhr, textStatus, err) {
				removeHourglass();
				if(xhr.readyState == 0 || xhr.status == 0) {
		              return;  // Not an error
				} else {
					alert("Error: Failed to get list of questions: " + err);
				}
			}
		});	
	}
	
	getAsyncQuestionList(sId, language, callback, groupId, qId, view);
}

//Set the language list in the survey view control
function setSurveyViewLanguages(list, language,elem, addNone) {

	var $languageSelect = $(elem);
	$languageSelect.empty();
	if(addNone) {
		$languageSelect.append('<option value="none">None</option>');
	}
	$.each(list, function(j, item) {
		$languageSelect.append('<option value="' + item.name + '">' + item.name + '</option>');
	});
	if(language) {
		$languageSelect.val(language);
	}
}

// Set the question list in the survey view control
function setSurveyViewQuestions(list, qId, view) {
	
	var $questionSelect = $('.selected_question'),
		label;
	
	$questionSelect.empty();
	$questionSelect.append('<option value="-1">None</option>');

	if(list) {
		$.each(list, function(j, item) {
			if(typeof item.q === "undefined") {
				label = "";
			} else {
				label = item.q;
			}
			if(item.is_ssc) {
				$questionSelect.append('<option value="' + item.id + '">ssc : ' + item.name + " : " + item.fn + '</option>');
			} else {
				$questionSelect.append('<option value="' + item.id + '">' + item.name + " : " + label + '</option>');
			}
		});
	}
	if(!qId) {
		qId = "-1";
	}
	$questionSelect.val(qId);
	if(view) {
		setFilterFromView(view);	// Set the filter dialog settings
	}

}

/*
 * ------------------------------------------------------------
 * Web service Functions
 */
function languageListUrl (sId) {

	var url = "/surveyKPI/languages/";
	url += sId;
	return url;
}

/*
 * Web service handler for retrieving available "count" questions for graph
 *  @param {string} survey
 */
function questionListUrl (sId, language, exc_read_only) {

	var url = "/surveyKPI/questionList/", 
		ro_text;
	
	if(exc_read_only) {
		ro_text = "true";
	} else {
		ro_text = "false";
	}
	
	url += sId;
	url += "/" + language;
	url += "?exc_read_only=" + ro_text;
	return url;
}

/**
 * Web service handler for question Meta Data
 * @param {string} survey id
 * @param {string} question id
 */
function questionMetaURL (sId, lang, qId) {

	var url = "/surveyKPI/question/";
	url += sId;
	url += "/" + lang;
	url += "/" + qId;
	url += "/getMeta";
	return url;
}

/*
 * Get a survey details - depends on globals being set
 */
function getSurveyDetails(callback) {

	var url="/surveyKPI/surveys/" + globals.gCurrentSurvey;
	
	if(!globals.gCurrentSurvey) {
		alert("Error: Can't get survey details, Survey identifier not specified");
	} else {
		addHourglass();
		$.ajax({
			url: url,
			dataType: 'json',
			cache: false,
			success: function(data) {
				removeHourglass();
				globals.model.survey = data;
				globals.model.setSettings();
				setLanguages(data.languages);
				
				if(typeof callback == "function") {
					callback();
				}
			},
			error: function(xhr, textStatus, err) {
				removeHourglass();
				if(xhr.readyState == 0 || xhr.status == 0) {
		              return;  // Not an error
				} else {
					if(xhr.status == 404) {
						// The current survey has probably been deleted or the user no longer has access
						globals.gCurrentSurvey = undefined;
						return;		
					}
					alert("Error: Failed to get survey: " + err);
				}
			}
		});	
	}
		
}
	
/*
 * Set the languages for the editor
 */
function setLanguages(languages) {
	
	var h = [],
		idx = -1,
		$lang = $('.language_list'),
		$lang1 = $('#language1'),
		$lang2 = $('#language2'),
		i;
	
	gLanguage1 = 0;	// Language indexes used for translations
	gLanguage2 = 0;
	if(languages.length > 1) {
		gLanguage2 = 1;
	}

	for (i = 0; i < languages.length; i++) {
		h[++idx] = '<option value="';
			h[++idx] = i;
			h[++idx] = '">';
			h[++idx] = languages[i];
		h[++idx] = '</option>';
	}
	$lang.empty().append(h.join(""));
	$(".language_list option[value='" + globals.gLanguage + "']").attr("selected", "selected");
	$lang1.val(gLanguage1);
	$lang2.val(gLanguage2)
}

/*
 * Get a survey details - depends on globals being set
 */
function createNewSurvey(name, callback) {

	var url="/surveyKPI/surveys/new/" + globals.gCurrentProject + "/" + name;
	
	addHourglass();
	$.ajax({
		type: "POST",
		url: url,
		dataType: 'json',
		cache: false,
		success: function(data) {
			removeHourglass();
			globals.model.survey = data;
			globals.model.setSettings();
			globals.gCurrentSurvey = data.id;
			console.log("New Survey");
			console.log(data);
			setLanguages(data.languages);
			
			if(typeof callback == "function") {
				callback();
			}
		},
		error: function(xhr, textStatus, err) {
			removeHourglass();
			if(xhr.readyState == 0 || xhr.status == 0) {
	              return;  // Not an error
			} else {
				alert("Error: Failed to create survey: " + xhr.responseText);
			}
		}
	});	
}

/*
 * Open a form for editing
 */
function openForm(type) {
	if(type === "new") {
		$('.existing_form').hide();
		$('.new_form').show();
		$('#openSurveyLabel').html("New Form");
		$('#get_form').html("Create");
		globals.gExistingSurvey = false; 
	} else {
		$('.existing_form').show();
		$('.new_form').hide();
		$('#openSurveyLabel').html("Open Form");
		$('#get_form').html("Open");
		globals.gExistingSurvey = true; 
	}
	$('#openFormModal').modal('show');
}

/*
 * Return true if thi is a business server
 */
function isBusinessServer() {
	var hostname = location.hostname;
	var bs = true;
	
	if(hostname !== 'localhost' &&
			hostname !== 'dev.smap.com.au' &&
			hostname.indexOf('zarkman.com') < 0) {
		bs = false;
	}
	return bs;
}

/*
 * Validate start and end dates
 */
function validDates() {
	var $d1 = $('#startDate'),
		$d2 = $('#endDate'),
		d1 = $d1.data("DateTimePicker").getDate(),
		d2 = $d2.data("DateTimePicker").getDate()
			
	if(!d1 || !d1.isValid()) {
		$('#ut_alert').show().text("Invalid Start Date");
		setTimeout(function() {
			$('.form-control', '#startDate').focus();
	    }, 0);		
		return false;
	}
	
	if(!d2 || !d2.isValid()) {
		$('#ut_alert').show().text("Invalid End Date");
		setTimeout(function() {
			$('.form-control', '#endDate').focus();
	    }, 0);	
		return false;
	}
	
	if(d1 > d2) {
		$('#ut_alert').show().text("End date must be greater than or the same as the start date");
		setTimeout(function() {
			$('.form-control', '#startDate').focus();
	    }, 0);	
		return false;
	}
	
	$('#ut_alert').hide();
	return true;
}

/*
 * Convert a date into UTC
 */
function getUtcDate($element, start, end) {
	
	var theDate,
		utcDate;
	
	if(start) {
		theDate = $element.data("DateTimePicker").getDate().startOf('day');
	} else if (end) {
		theDate = $element.data("DateTimePicker").getDate().endOf('day');
	} else {
		theDate = $element.data("DateTimePicker").getDate();
	}
	
	utcDate = moment.utc(theDate);
	
	console.log("date:" + theDate.format("YYYY-MM-DD HH:mm:ss"));
	console.log("UTC:" + utcDate.format("YYYY-MM-DD HH:mm:ss"));
	
	return utcDate.valueOf();

}