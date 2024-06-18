const functions = require('@google-cloud/functions-framework');

const webhook_url = "YOUR_WEBHOOK";
const target_system = "choose" // ms_teams | slack

functions.cloudEvent('send_alert',async cloudEvent => {
    console.log("Functions started");

    const base64name = cloudEvent.data.message.data;

    let pub_sub_message = base64name
      ? Buffer.from(base64name, 'base64').toString()
      : 'empty';
    
    pub_sub_message = JSON.parse(pub_sub_message);

    // if pub_sub_message is an assertion
    if(pub_sub_message.severity =="ERROR" && pub_sub_message?.protoPayload?.serviceData?.jobGetQueryResultsResponse?.job?.jobConfiguration?.query?.statementType == "ASSERT" ){
        const error_message = pub_sub_message.protoPayload.status.message;
        const error_query = pub_sub_message.protoPayload.serviceData.jobGetQueryResultsResponse.job.jobConfiguration.query.query;
        const tested_table = pub_sub_message.protoPayload.serviceData.jobGetQueryResultsResponse.job.jobStatistics.referencedTables[0];
       
        const bigquery_job_id = pub_sub_message.protoPayload.serviceData.jobGetQueryResultsResponse.job.jobName.jobId;
        const bigquery_project_id = pub_sub_message.protoPayload.serviceData.jobGetQueryResultsResponse.job.jobName.projectId;
        const bigquery_location = pub_sub_message.protoPayload.serviceData.jobGetQueryResultsResponse.job.jobName.location;

        const notification_title = `Error Alert: ${error_message}`;
        const notification_message = `The BigQuery job \`${bigquery_job_id}\` in the project \`${bigquery_project_id}\` just failed. This was the query: \n\`\`\`${error_query}\`\`\`\nCheck the link for details.`;

        console.log(error_query);
        console.log(tested_table);
        
        const regex = /`(.*?)`/g;

        const bigquery_job_link = {
            "text":"Open BigQuery Job",
            "url": `https://console.cloud.google.com/bigquery?project=${bigquery_project_id}&j=bq:${bigquery_location}:${bigquery_job_id}&page=queryresults`
        }

        const dataform_repo_link = {
            "text":"Dataform Repository",
            "url":`https://console.cloud.google.com/bigquery/dataform?project=${bigquery_project_id}`
        }
        // Extract assertion table id
        const assertion_source  = error_query.match(regex)[0];
        console.log(assertion_source);

        sendToWebhook(notification_title,notification_message,bigquery_job_link,dataform_repo_link);
    } 
    // if dataform workflow execution completed
    else if(pub_sub_message?.jsonPayload["@type"] =="type.googleapis.com/google.cloud.dataform.logging.v1.WorkflowInvocationCompletionLogEntry" && pub_sub_message?.jsonPayload?.releaseConfigId){
        const terminal_state = pub_sub_message?.jsonPayload?.terminalState;
        const workflow_invocation_id = pub_sub_message?.jsonPayload?.workflowInvocationId;
        const release_config_id = pub_sub_message?.jsonPayload?.releaseConfigId;
        const workflow_config_id = pub_sub_message?.jsonPayload?.workflowConfigId; 
        const dataform_repository_id = pub_sub_message?.resource?.labels?.repository_id;
        const dataform_location = pub_sub_message?.resource?.labels?.location;
        const execution_time = pub_sub_message?.timestamp;
        const notification_title = `${terminal_state} Dataform Execution ${workflow_config_id} at ${execution_time}`;
        const notification_message = `The Dataform execution ${workflow_invocation_id} ${terminal_state}. The release config was: ${release_config_id} and the workflow config was: ${workflow_config_id}`;
        console.log(`Invocation: ${workflow_invocation_id} ${terminal_state} - Release Config: ${release_config_id} and Workflow Config: ${workflow_config_id}`);
        // https://console.cloud.google.com/bigquery/dataform/locations/europe-west3/repositories/mktDWH_repo/workflows/1718706567-c5cfb92d-6063-40e8-aba2-00fe4700bd28?project=mktdwh
        const execution_link = {
            "text": "Open Dataform Execution",
            "url": `https://console.cloud.google.com/bigquery/dataform/locations/${dataform_location}/repositories/${dataform_repository_id}/workflows/${workflow_invocation_id}?`
        }
        sendToWebhook(notification_title,notification_message,execution_link);
    }
    else {
        console.log("Wrong Pub/Sub message found.");
    }

});

/**
 * Send a message to slack including some helpful informations for debugging
 * @param {*} notification_title - The title of the notification sent to slack or ms teams
 * @param {*} notification_message - The body of the notification sent to slack or ms teams
 * @param {*} url_1 - The link for the first button 
 * @param {*} url_2 - The link for the second button
 */
async function sendToWebhook(notification_title,notification_message,url_1,url_2) {
     try {
        if(target_system == "slack"){
            const slack_message_blocks = [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": notification_title,
                        "emoji": true
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": notification_message
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": url_1.text,
                                "emoji": true
                            },
                            "value": "bigquery_job",
                            "url": url_1.url, // Adjust URL as necessary
                            "action_id": "button-action1"
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": url_2.url,
                                "emoji": true
                            },
                            "value": "dataform",
                            "url": url_2.url , // Adjust URL as necessary
                            "action_id": "button-action2"
                        }
                    ]
                }
            ];
            // add second link if available
            if(url_2){
                slack_message_blocks[2].elements.push(
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": url_2.url,
                            "emoji": true
                        },
                        "value": "dataform",
                        "url": url_2.url , // Adjust URL as necessary
                        "action_id": "button-action2"
                    }
                );
            }
            const response = await fetch(webhook_url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({blocks: slack_message_blocks})
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        }

        if(target_system == "ms_teams"){
            const ms_teams_message = 
            {  
                "type":"message",  
                "attachments":[  
                {  
                    "contentType":"application/vnd.microsoft.card.adaptive",  
                    "contentUrl":null,  
                    "content":{  
                        "$schema":"http://adaptivecards.io/schemas/adaptive-card.json",  
                        "type":"AdaptiveCard",  
                        "version":"1.2",  
                        "body":[  
                            {
                                "type": "TextBlock",
                                "size": "Medium",
                                "weight": "Bolder",
                                "text": notification_title,
                                "style": "heading",
                                "wrap": true
                            },
                            {  
                                "type": "TextBlock",  
                                "text": notification_message,
                                "wrap": true
                            }
                        ],
                        "actions": [
                            {
                                "type": "Action.OpenUrl",
                                "title": url_1.text,
                                "url": url_1.url,
                            }
                        ],
                        
                    }  
                }  
                ]  
            } 
            if(url_2){
                ms_teams_message.attachments[0].content.actions.push(
                    {
                        "type": "Action.OpenUrl",
                        "title": url_2.text,
                        "url": url_2.url
                    }
                );
            }
            const response = await fetch(webhook_url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(ms_teams_message)
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
        }
     }
     catch(error){
        console.log(error);
     }
}



