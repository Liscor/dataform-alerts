const functions = require('@google-cloud/functions-framework');
//const fetch = require("node-fetch");

const slack_webhook_url = "slack";


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

        sendToSlack(error_message,error_query,bigquery_job_id,bigquery_project_id,bigquery_location);
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
async function sendToSlack(error_message,error_query,job_id,project_id,location) {
    const messageBlocks = [
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

    const response = await fetch(slack_webhook_url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({blocks: messageBlocks})
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
}