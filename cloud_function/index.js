const functions = require('@google-cloud/functions-framework');

const webhook_url = "YOUR_WEBHOOK_URL"
const target_system = "CHOOSE" // ms_teams | slack

functions.cloudEvent('send_alert',async cloudEvent => {
    console.log("Functions started");

    const base64name = cloudEvent.data.message.data;

    let pub_sub_message = base64name
      ? Buffer.from(base64name, 'base64').toString()
      : 'empty';
    
    pub_sub_message = JSON.parse(pub_sub_message);

    if(pub_sub_message.severity="ERROR"){
        const error_message = pub_sub_message.protoPayload.status.message;
        const error_query = pub_sub_message.protoPayload.serviceData.jobGetQueryResultsResponse.job.jobConfiguration.query.query;
        const tested_table = pub_sub_message.protoPayload.serviceData.jobGetQueryResultsResponse.job.jobStatistics.referencedTables[0];
       
        const bigquery_job_id = pub_sub_message.protoPayload.serviceData.jobGetQueryResultsResponse.job.jobName.jobId;
        const bigquery_project_id = pub_sub_message.protoPayload.serviceData.jobGetQueryResultsResponse.job.jobName.projectId;
        const bigquery_location = pub_sub_message.protoPayload.serviceData.jobGetQueryResultsResponse.job.jobName.location;

        console.log(error_query);
        console.log(tested_table);
        
        const regex = /`(.*?)`/g;

        // Extract assertion table id
        const assertion_source  = error_query.match(regex)[0];
        console.log(assertion_source);

        sendToWebhook(error_message,error_query,bigquery_job_id,bigquery_project_id,bigquery_location);
    } 
    else {
        console.log("protoPayload.resourceName not found.");
    }
});

/**
 * Send a message to slack including some helpful informations for debugging
 * @param {*} error_message - The error message provided by BigQuery
 * @param {*} error_query - The query triggering the error
 * @param {*} job_id  - BigQuery job id
 * @param {*} project_id - GCP project id
 * @param {*} location  - Location where the query was executed in
 */
async function sendToWebhook(error_message,error_query,job_id,project_id,location) {
     try {
        if(target_system == "slack"){
            const slack_message_blocks = [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": `Error Alert: ${error_message}`,
                        "emoji": true
                    }
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `The BigQuery job \`${job_id}\` in the project \`${project_id}\` just failed. This was the query: \n\`\`\`${error_query}\`\`\`\nCheck the link for details.`
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Open BigQuery Job",
                                "emoji": true
                            },
                            "value": "bigquery_job",
                            "url": `https://console.cloud.google.com/bigquery?project=${project_id}&j=bq:${location}:${job_id}&page=queryresults`, // Adjust URL as necessary
                            "action_id": "button-action1"
                        },
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Dataform Repositories",
                                "emoji": true
                            },
                            "value": "dataform",
                            "url": `https://console.cloud.google.com/bigquery/dataform?project=${project_id}`, // Adjust URL as necessary
                            "action_id": "button-action2"
                        }
                    ]
                }
            ];
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
                                "text": `Error Alert: ${error_message}`,
                                "style": "heading",
                                "wrap": true
                            },
                            {  
                                "type": "TextBlock",  
                                "text": `The BigQuery job \`${job_id}\` in the project \`${project_id}\` just failed. This was the query: \n\`\`\`${error_query}\nCheck the link for details.`,
                                "wrap": true
                            }],
                            "actions": [
                                {
                                    "type": "Action.OpenUrl",
                                    "title": "BigQuery Job",
                                    "url": `https://console.cloud.google.com/bigquery?project=${project_id}&j=bq:${location}:${job_id}&page=queryresults`,
                                },
                                {
                                    "type": "Action.OpenUrl",
                                    "title": "Dataform Project",
                                    "url": `https://console.cloud.google.com/bigquery/dataform?project=${project_id}`
                                }
                            ],
                        
                    }  
                }  
                ]  
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



