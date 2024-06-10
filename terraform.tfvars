# Project ID where terraform will build the assests in 
project_id = "YOUR_GCP_PROJECT_ID"

# All resources will be built in this region
region =  "europe-west3"

# Can remain the same - test before usage
error_log_filter = "severity=\"ERROR\" AND resource.type=\"bigquery_resource\" AND protoPayload.methodName=\"jobservice.getqueryresults\" AND protoPayload.status.message=\"Assertion failed, expected zero rows.\""

# Used to name the google storage bucket
google_storage_bucket_name = "SOME_RANDOM_BUCKET_NAME"
