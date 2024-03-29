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

/*
 * Quick solution to issue of legacy globals after migrating to AMD / require.js
 */
define(function() {
	window.globals = {
	
		gProjectList: undefined,
		gCurrentProject: 0,
		gCurrentSurvey: 0,
		gCurrentLayer: undefined,
		gLoggedInUser: undefined,
		gEditingReportProject: undefined,   		// Set if fieldAnalysis called to edit a report
		gIsAdministrator: false,
		gIsAnalyst: false,
		gIsOrgAdministrator: false,
		gSendTrail: false,
		gViewIdx: 0,
		gSelector: new Selector(),
		
		gRegions: undefined,
		gRegion: {},
		
		gServerCanSendEmail: false,
		
		// Reports
		gEmailEnabled: false,
		gFacebookEnabled: false,
		gTwitterEnabled: false,
		
		// Tasks
		gCurrentUserId: undefined,
		gCurrentUserName: undefined,
		gAssignmentsLayer: undefined,
		gPendingUpdates: [],
		
		// Editor
		gExistingSurvey: false,		// Set true if modifying an existing survey
		gElementIndex: 0,			// Manage creation of unique identifier for each element (question, option) in editor			
		gQuestionIndex: 0,			// Manage creation of unique identifier for questions
		gNewQuestionButtonIndex: 0,	// Manage creation of unique identifier for buttons that add new questions
		gNewOptionButtonIndex: 0,
		gOptionIndex: 0,			// Manage creation of unique identifier for options
		gCurrentFormId: 0,
		gSId: 0,
		gLanguage: 0,
		
		model: new Model()

	}
	
	return window.globals;
	
	function Selector() {
		
		this.dataItems = new Object();
		//this.panelDataItems = new Object();
		this.surveys = new Object();
		this.surveyLanguages = new Object();
		this.surveyQuestions = new Object();
		this.questions = new Object();
		this.allSurveys;				// Simple list of surveys
		this.allRegions;
		this.sharedMaps;
		this.views = [];			// Simple list of views
		this.maps = {};				// map panels indexed by the panel id
		this.changed = false;
		this.SURVEY_KEY_PREFIX = "surveys";
		this.TASK_KEY = "tasks";
		this.TASK_COLOR = "#dd00aa";
		this.SURVEY_COLOR = "#00aa00";
		this.SELECTED_COLOR = "#0000aa";
		this.currentPanel = "map";
		
		/*
		 * Get Functions
		 */
		this.getAll = function () {
			return this.dataItems;
		};
		
		this.getItem = function (key) {
			return this.dataItems[key];
		};
		
		// Return all the table data available for a survey
		this.getFormItems = function (sId) {
			var tableItems = new Object();
			for(var key in this.dataItems) {
				var item = this.dataItems[key];
				if(item.table == true && item.sId == sId) {
					tableItems[key] = item;
				}
			}
			return tableItems;
		};
		
		this.getSurvey = function (key) {
			return this.surveys[key];
		};
		
		this.getSurveyQuestions = function (sId, language) {
			var langQ = this.surveyQuestions[sId];
			if(langQ) {
				return langQ[language];
			} else {
				return null;
			}
		};
		
		this.getSurveyLanguages = function (key) {
			return this.surveyLanguages[key];
		};
		
		// Returns the list of surveys on the home server
		this.getSurveyList = function () {
			return this.allSurveys;
		};
		
		this.getRegionList = function () {
			return this.allRegions;
		};
		
		this.getSharedMaps = function () {
			return this.sharedMaps;
		};
		
		// deprecate question meta should be replaced by all question details in the question list
		this.getQuestion = function(qId, language) {
			var langQ = this.questions[qId];
			if(langQ) {
				return langQ[language];
			} else {
				return null;
			}
		};
		
		/*
		 * Get the question details that came with the question list
		 * This approach should replace the concept of "question meta"
		 */
		this.getQuestionDetails = function(sId, qId, language) {
			var qList = this.getSurveyQuestions(sId, language),
				i;
			
			for(i = 0; i < qList.length; i++) {
				if(qList[i].id == qId) {
					return qList[i];
				}
			}
			return null;
		};
		
		this.hasQuestion = function(key) {
			if(this.questions[key] != undefined) {
				return true;
			} else {
				return false;
			}
		};
		
		// Return the list of current views
		this.getViews = function () {
			return this.views;
		};
		
		// Return a map if it exists
		this.getMap = function (key) {
			return this.maps[key];
		};
		
		
		/*
		 * Set Functions
		 */
		this.addDataItem = function (key, value) {
			this.dataItems[key] = value;
			this.changed = true;
		};	
		
		this.clearDataItems = function () {
			this.dataItems = new Object();
		};	
		
		this.clearSurveys = function () {
			this.surveys = new Object();
			this.surveyLanguages = new Object();
			this.surveyQuestions = new Object();
			this.questions = new Object();
			this.allSurveys = undefined;				
			this.allRegions = undefined;
		};	
		
		this.setSurveyList = function (list) {
			this.allSurveys = list;
			if(typeof list[0] !== "undefined") {
				this.selectedSurvey = list[0].sId;
			}
		};	
		
		this.setSurveyLanguages = function (key, value) {
			this.surveyLanguages[key] = value;
		};
		
		this.setSurveyQuestions = function (sId, language, value) {
			var langQ = new Object();
			langQ[language] = value;
			this.surveyQuestions[sId] = langQ;
		};
		
		this.setRegionList = function (list) {
			this.allRegions = list;
		};	
		
		this.setSharedMaps = function (list) {
			this.sharedMaps = list;
		};	
		
		this.addSurvey = function (key, value) {
			this.surveys[key] = value;
		};
		
		this.setSelectedSurvey = function (survey) {
			this.selectedSurvey = survey;
		};
		
		this.setSelectedQuestion = function (id) {
			this.selectedQuestion = id;
		};
		
		this.addQuestion = function (qId, language, value) {	
			var langQ = this.questions[qId];
			if(!langQ) {
				this.questions[qId] = new Object();
				langQ = this.questions[qId];
			}
			langQ[language] = value;
		};	
		
		// Set the list of views to the passed in array
		this.setViews = function (list) {
			this.views = list;
		};	
		
		// Set the passed in map into the maps object indexed by key
		this.setMap = function (key, value) {
			this.maps[key] = value;
		};
		
	}
	
	/*
	 * Model for Survey editing
	 */
	function Model() {
		
		this.survey = undefined;
		//this.changes = [];
		//this.currentChange = 0;
		this.savedSettings = undefined;
		this.forcceSettingsChange = false;	

		this.qTypes =[{
				name: "Text",
				type: "string",
				glyphicon: "font",
				canSelect: true,
				visible: true,
				source: "user"
			},
			{
				name: "Select One",
				type: "select1",
				image: "/images/select1_64.png",
				canSelect: true,
				visible: true,
				source: "user"
			},
			{
				name: "Select Multiple",
				type: "select",
				image: "/images/select_64.png",
				canSelect: true,
				visible: true,
				source: "user"
			},
			{
				name: "Form",
				type: "begin repeat",
				glyphicon: "repeat",
				canSelect: true,
				visible: true,
				source: "user"
			},
			{
				name: "Group",
				type: "begin group",
				glyphicon: "folder-open",
				canSelect: true,
				visible: true,
				source: "user"
			},
			{
				name: "Image",
				type: "image",
				glyphicon: "camera",
				canSelect: true,
				visible: true,
				source: "user"
			},
			{
				name: "Audio",
				type: "audio",
				glyphicon: "volume-up",
				canSelect: true,
				visible: true,
				source: "user"
			},
			{
				name: "Video",
				type: "video",
				glyphicon: "facetime-video",
				canSelect: true,
				visible: true,
				source: "user"
			},
			{
				name: "GPS Point",
				type: "geopoint",
				glyphicon: "map-marker",
				canSelect: true,
				visible: true,
				source: "user"
			},
			{
				name: "Date",
				type: "date",
				glyphicon: "calendar",
				canSelect: true,
				visible: true,
				source: "user"
			},
			{
				name: "Date and Time",
				type: "dateTime",
				glyphicon: "calendar",
				canSelect: true,
				visible: true,
				source: "user"
			},
			{
				name: "Time",
				type: "time",
				glyphicon: "time",
				canSelect: true,
				visible: true,
				source: "user"
			},
			{
				name: "Barcode",
				type: "barcode",
				glyphicon: "barcode",
				canSelect: true,
				visible: true,
				source: "user"
			},
			{
				name: "Integer",
				type: "int",
				text: "#",
				canSelect: true,
				visible: true,
				source: "user"
			},
			{
				name: "Decimal",
				type: "decimal",
				text: "#.#",
				canSelect: true,
				visible: true,
				source: "user"
			},
			{
				name: "GPS Line",
				type: "geolinestring",
				image: "/images/linestring_64.png",
				canSelect: true,
				visible: true,
				source: "user"
			},
			{
				name: "GPS Area",
				type: "geopolygon",
				image: "/images/polygon_64.png",
				canSelect: true,
				visible:true,
				source: "user"
			},
			{
				name: "Calculation",
				type: "string",
				calculation: true,
				image: "/images/calc_64.png",
				canSelect: true,
				visible:true,
				source: "user"
			},
			{
				name: "Unknown Type",
				glyphicon: "record",
				canSelect: false
			}
		];
		
		
		// Save the settings for the survey
		this.save_settings = function() {
			
			var settings = JSON.stringify(this.getSettings());
			$('#pdfSettings').val(settings);
	    	var f = document.forms.namedItem("pdftemplate");
	    	var formData = new FormData(f);
			
			addHourglass();
			$.ajax({
				  type: "POST",
				  data: formData,
				  cache: false,
	              contentType: false,
	              processData:false,
				  url: "/surveyKPI/surveys/save_settings/" + globals.gCurrentSurvey,
				  success: function(data, status) {
					  removeHourglass();
					  globals.model.savedSettings = settings;
					  globals.model.forceSettingsChange = false;
					  $('#save_settings').attr("disabled", true);
					  
					  $('.formName').html(globals.model.survey.displayName);
					  $('#settingsModal').modal("hide");
				  },
				  error: function(xhr, textStatus, err) {
					  removeHourglass();  	
					  if(xhr.readyState == 0 || xhr.status == 0) {
					      return;  // Not an error
					 } else {
						 bootbox.alert("Error saving settings. " + xhr.responseText);
					 }
				  }
			});
			
		};
		
		// Apply the current change
		/*
		this.doChange = function() {
			
			var change = this.changes[this.currentChange];
			var i,
				question;

			if(change.type === "label") {
				for(i = 0; i < change.items.length; i++) {
					label = change.items[i];
					
					if(label.form) {
						this.survey.forms[label.formIdx].questions[label.questionIdx].
							labels[label.language][label.element] = label.newVal;
					} else if(label.optionListIdx) {
						this.survey.optionLists[label.optionListIdx][label.optionIdx].
							labels[label.language][label.element] = label.newVal;
					}
				}
			} 
			
		}
		
		this.undo = function() {
			var change = this.changes[this.currentChange--];
			this.setHasChanges(this.changes.length);
			if(change.type === "label") {
				for(i = 0; i < change.labels.length; i++) {
					label = change.labels[i];
					if(label.form) {
						this.survey.forms[label.formIdx].questions[label.questionIdx].
							labels[label.language][label.element] = label.oldVal;
					} else if(question.optionList) {
						this.survey.optionLists[label.optionListIdx][label.optionIdx].
							labels[label.language][label.element] = label.oldVal;
					}
				}
			} 
		}
		
		this.redo = function() {
			if(this.currentChange < this.changes.length - 1) {
				this.currentChange++;
				this.setHasChanges(this.changes.length);
				this.doChange();
			}
		}
		
		
		// Add a question, option or language
		this.addElement = function(item) {
			
			this.currentChange = this.changes.push(item) - 1;
			this.doChange();				// Apply the current change
			this.setHasChanges(this.changes.length);
		}
		
		// Modify a label for a question or an option called from translate where multiple questions can be modified at once if the text is the same
		
		this.modLabel = function(language, changedQ, newVal, element, prop) {
			
			var labelMod = {
					type: prop,
					items: []
			}
			
			var i,
				label = {},
				item,
				qname;
				
			
			for(i = 0; i < changedQ.length; i++) {
				label = {};

				// For questions
				if(typeof changedQ[i].form !== "undefined") {
					label.formIdx = changedQ[i].form;													// done
					label.questionIdx = changedQ[i].question;											// done
					label.type = "question";															// done
					item = this.survey.forms[label.formIdx].questions[label.questionIdx];				// done
					item_orig = this.survey.forms_orig[label.formIdx].questions[label.questionIdx];		// done
					label.name = item.name;																// done
					label.qId = item.id;																// done
				} else {
					// For options
					label.optionListIdx = changedQ[i].optionList;										// done
					qname = changedQ[i].qname;															// done
					label.optionIdx = changedQ[i].option;												// done
					item = this.survey.optionLists[label.optionListIdx][label.optionIdx];				// done
					item_orig = this.survey.optionLists_orig[label.optionListIdx][label.optionIdx];		// done
					label.type = "option";																// done
					label.name = label.optionListIdx;		// The option list name						// done
				}
					
				label.newVal = newVal;																	// done
				if(prop === "label" || prop === "media") {												// done
					label.oldVal = item_orig.labels[language][element]; 								// done
				} else {
					label.oldVal = item_orig[prop];														// done
				}
				label.element = element;																// done
				label.language = language;																// done
				
				label.languageName = this.survey.languages[language];			// For logging the event // done
				var form = this.survey.forms[label.formIdx];											// done

				if(item.text_id) {
					label.key = item.text_id;
				} else {
					// Create reference for this new Label		
					if(typeof changedQ[i].form !== "undefined") {
						label.key = "/" + form.name + "/" + item.name + ":label";	// TODO hint
					} else {
						label.key = "/" + form.name + "/" + qname + "/" + item.name + ":label";
					}
				}

				labelMod.items.push(label);
			}
			
			removeDuplicateChange(this.changes, labelMod);
			if(labelMod.items[0].newVal !== labelMod.items[0].oldVal) {		// Add if the value has changed
				this.currentChange = this.changes.push(labelMod) - 1;
				this.doChange();				// Apply the current change
			}
			this.setHasChanges(this.changes.length);
		};
		*/
		/*
		 * Functions for managing settings
		 */
		this.getSettings = function() {
			var current =  this.createSettingsObject(
				$('#set_survey_name').val(),
				$('#set_instance_name').val(),
				$('#set_project_name option:selected').val(),
				$('#set_default_language option:selected').text(),
				$('#task_file').prop('checked')
			);
			
			// Update the model to reflect the current values
			this.survey.displayName = current.displayName;
			this.survey.instanceNameDefn = current.instanceNameDefn;
			this.survey.p_id = current.p_id;
			this.survey.def_lang = current.def_lang;
			this.survey.task_file = current.task_file;
			
			return current;
		} 
		
		this.setSettings = function() {
			this.savedSettings = JSON.stringify(
					this.createSettingsObject(
								this.survey.displayName, 
								this.survey.instanceNameDefn,
								this.survey.p_id, 
								this.survey.def_lang,
								this.survey.task_file
								));
			
			this.forceSettingsChange = false;
		} 
		
		this.createSettingsObject = function(displayName, instanceNameDefn, p_id, def_lang, task_file) {
			
			var projId;
			if(typeof p_id === "string") {
				projId = parseInt(p_id);
			} else {
				projId = p_id;
			}
			return {
				displayName: displayName,
				instanceNameDefn: instanceNameDefn,
				p_id: projId,
				def_lang: def_lang,
				task_file: task_file
			}
		}
		
		this.settingsChange = function() {
			var current = globals.model.getSettings();
			
			if(JSON.stringify(current) !== globals.model.savedSettings || globals.model.forceSettingsChange) {
				$('#save_settings').attr("disabled", false);
			} else {
				$('#save_settings').attr("disabled", true);
			}
		}
		
		/*
		 * If the user select a pdfTemplate that has been modified but its name has not changed then
		 * the settings values will not be different but we want to enable an upload of the new template.
		 * Hence set the forceSettingChange flag.
		 */
		this.settingsAddPdfClicked = function() {
			globals.model.forceSettingsChange = true;
			$('#save_settings').attr("disabled", false);
		}
	}

	
});
