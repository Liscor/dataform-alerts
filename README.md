# Dataform Error Alert to Slack

This Node.js application is designed to send alerts to a Slack channel when an assertion in Dataform fails. The application is deployed as a Google Cloud Functions and listens for Pub/Sub messages indicating a job error, then sends a formatted message to Slack with details about the error for debugging purposes.

## Requirements

- `@google-cloud/functions-framework` package
- A Slack webhook URL - You need to create a Slack App for your workspace to obtain this
- Log Router/Pub/Sub topic - Set up a log router for the failed assertion with a Pub/Sub as the destination

## Filter Log Router
Create a log router with the following filter with a Pub/Sub topic as destination.
```js
severity=ERROR
resource.type="bigquery_resource"
protoPayload.methodName="jobservice.getqueryresults"
protoPayload.status.message="Assertion failed, expected zero rows." 
```

## Setup

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd <repository-directory>
