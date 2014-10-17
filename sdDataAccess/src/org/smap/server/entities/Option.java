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

package org.smap.server.entities;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

import javax.persistence.CascadeType;
import javax.persistence.Column;
import javax.persistence.Entity;
import javax.persistence.FetchType;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.persistence.JoinColumn;
import javax.persistence.ManyToOne;
import javax.persistence.SequenceGenerator;
import javax.persistence.Transient;

@Entity(name="OPTION")
public class Option implements Serializable{
	
	private static final long serialVersionUID = -6410553162606844278L;

	@Id
	@Column(name="o_id", nullable=false)
	@GeneratedValue(strategy = GenerationType.AUTO, generator="o_seq")
	@SequenceGenerator(name="o_seq", sequenceName="o_seq")
	private int o_id;
	
	@ManyToOne(cascade = CascadeType.ALL, fetch = FetchType.LAZY, optional = true)
	@JoinColumn(name = "q_id", referencedColumnName = "q_id")
	private Question question;
	
	@Column(name="label")
	private String label = null;
	
	@Column(name="label_id")
	private String label_id = null;
	
	@Column(name="ovalue")
	private String value = null;

	@Column(name="cascade_filters")
	private String cascade_filters = null;
	
	@Column(name="seq")
	private int seq;			// Order in which options should be displayed
	
	@Transient
	private String questionRef = null;	// Reference of the parent question
	@Transient
	private String cascadeInstanceId = null;  // Reference to a cascade instance
	@Transient
	private HashMap<String, String> cascadeKeyValues = new HashMap<String, String>();
	
	public Option() {
		
	}
	
	public Option(Option anOption) {
		this.o_id = anOption.getId();
		this.question = anOption.getQuestion();
		this.label = anOption.getLabel();
		this.label_id = anOption.getLabelId();
		this.value = anOption.getValue();
		this.seq = anOption.getSeq();
		this.questionRef = anOption.getQuestionRef();
		this.cascadeInstanceId = anOption.getCascadeInstanceId();
		this.cascadeKeyValues = new HashMap<String, String> (anOption.getCascadeKeyValues());
	}

	/*
	 * Getters
	 */
	public int getId() {
		return o_id;
	}
	
	public Question getQuestion() {
		return question;
	}
	
	public String getLabel() {
		return label;
	}
	
	public String getLabelId() {
		return label_id;
	}
	
	public String getValue() {
		return value;
	}

	public int getSeq() {
		return seq;
	}
	
	public String getQuestionRef() {
		return questionRef;
	}
	
	public String getCascadeInstanceId() {
		return cascadeInstanceId;
	}
	
	public HashMap<String, String> getCascadeKeyValues() {
		return cascadeKeyValues;
	}
 
	/*
	 * Setters
	 */
    public void setQuestion(Question id) {
    	question = id;
    }
    
	public void setLabel(String label) {
		this.label = label;
	}
	
	public void setLabelId(String v) {
		label_id = v;
	}
	
	public void setValue(String v) {
		value = v;
	}
	
       
    public void setSeq(int sequence) {
    	seq = sequence ;
    }
    
    public void addCascadeKeyValue(String k, String v) {
    	cascadeKeyValues.put(k, v);
    }
    
    public void setQuestionRef(String qRef) {
    	questionRef = qRef ;
    }
    
    public void setCascadeInstanceId(String v) {
    	cascadeInstanceId = v;
    }
    
    // Set the filter text string from the list of key value pairs
    public void setCascadeFilters() {
    	List<String> keyList = new ArrayList<String>(cascadeKeyValues.keySet());
    	String filter = "";
    	int count = 0;
    	for(String k : keyList) {
    		if(count++ != 0) {
    			filter += " ";
    		}
    		filter += k + " " + cascadeKeyValues.get(k);
    	}
    	cascade_filters = filter;
    }
    
    // Set the key value pairs from the filter text string
    public void setCascadeKeyValues() {
    	cascadeKeyValues.clear();
    	
    	String [] kvs = cascade_filters.split(" ");
    	
    	for(int i = 0; i < kvs.length; i += 2) {
    		if((i + 1) < kvs.length) {
    			cascadeKeyValues.put(kvs[i], kvs[i+1]);
    		}
    	}
    }
    

}