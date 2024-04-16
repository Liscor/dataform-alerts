# Project ID where terraform will build the assests in 
project_id = "patrizia-s2s-bigquery"

# All resources will be built in this region
region =  "europe-west3"

error_log_filter = "severity=\"ERROR\" AND resource.type=\"bigquery_resource\" AND protoPayload.methodName=\"jobservice.getqueryresults\" AND protoPayload.status.message=\"Assertion failed, expected zero rows.\""

# Used to name the google storage bucket
google_storage_bucket_name = "mycf12312_storage_bucket"

# not_used
slack_webhook = "https://mohrstade.de"