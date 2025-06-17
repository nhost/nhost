twilio-go changelog
====================
[2025-06-12] Version 1.26.3
---------------------------
**Api**
- Change DependentPhoneNumber `capabilities` type `object` and `date_created`, `date_updated` to `date_time<rfc2822>`
- Updated the `Default` value from 0 to 1 in the Recordings Resource `channels` property

**Serverless**
- Update `ienum` type level in Logs api

**Verify**
- Update Channel list in Verify Attempst API
- Update `ienum` type for Conversion_Status in Verify Attempts API

**Twiml**
- Add `us2` to the list of supported values for the region attribute in the `<Conference>` TwiML noun.


[2025-05-29] Version 1.26.2
---------------------------
**Library - Chore**
- [PR #289](https://github.com/twilio/twilio-go/pull/289): add mocking for Oauth. Thanks to [@manisha1997](https://github.com/manisha1997)!

**Api**
- Added several usage category enums to `usage_record` API

**Numbers**
- Update the porting documentation

**Verify**
- Update `ienum` type for Channels in Verify Attempts API


[2025-05-13] Version 1.26.1
---------------------------
**Library - Docs**
- [PR #285](https://github.com/twilio/twilio-go/pull/285): add changelog for jwt v5. Thanks to [@tiwarishubham635](https://github.com/tiwarishubham635)!

**Accounts**
- Changes to add date_of_consent param in Bulk Consent API

**Api**
- Change `friendly_name`, `date_created` and `date_updated` properties to type `string`.

**Twiml**
- Update twiml definition for `<ConversationRelay>` and `<Assistant>`


[2025-05-05] Version 1.26.0
---------------------------
**Library - Chore**
- [PR #282](https://github.com/twilio/twilio-go/pull/282): add access token example. Thanks to [@manisha1997](https://github.com/manisha1997)!
- [PR #277](https://github.com/twilio/twilio-go/pull/277): retract 1.25.0. Thanks to [@tiwarishubham635](https://github.com/tiwarishubham635)!
- [PR #275](https://github.com/twilio/twilio-go/pull/275): cluster test. Thanks to [@manisha1997](https://github.com/manisha1997)!

**Library - Feature**
- [PR #281](https://github.com/twilio/twilio-go/pull/281): orgs api. Thanks to [@manisha1997](https://github.com/manisha1997)!

**Library - Fix**
- [PR #280](https://github.com/twilio/twilio-go/pull/280): update github.com/golang-jwt/jwt to address vulnerability. Thanks to [@sigi-glovebox](https://github.com/sigi-glovebox)! **(breaking change)**
  - The JWT library been updated to version v5 and may require changes to your code. We recommend adding indirect dependency to your go.mod file to ensure compatibility. For example, you can add the following line to your go.mod file:
  ```
  require (
        github.com/golang-jwt/jwt/v5 v5.2.2 // indirect
    )
  ```

**Api**
- Add `response_key` for `Usage Triggers` fetch endpoint.

**Flex**
- Add Update Interaction API
- Adding `webhook_ttid` as optional parameter in Interactions API

**Serverless**
- Add node22 as a valid Build runtime
- Add node20 as a valid Build runtime

**Video**
- removed `transcribe_participants_on_connect` and `transcriptions_configuration` from the room resource **(breaking change)**
- Added `transcribe_participants_on_connect` and `transcriptions_configuration` to the room resource


[2024-04-08] Version 1.25.1
---------------------------
**Library - Chore**
- Retract v1.25.0 due to build issue [#276](https://github.com/twilio/twilio-go/issues/276)

[2025-04-07] Version 1.25.0
---------------------------
**Library - Chore**
- [PR #268](https://github.com/twilio/twilio-go/pull/268): Added patch method support. Thanks to [@sbansla](https://github.com/sbansla)!
- [PR #274](https://github.com/twilio/twilio-go/pull/274): Readme changes. Thanks to [@manisha1997](https://github.com/manisha1997)!
- [PR #273](https://github.com/twilio/twilio-go/pull/273): update readme. Thanks to [@manisha1997](https://github.com/manisha1997)!

**Library - Feature**
- [PR #272](https://github.com/twilio/twilio-go/pull/272): Oauth design (#269). Thanks to [@manisha1997](https://github.com/manisha1997)!

**Studio**
- Add documentation for parent_step_sid field in Step resource


[2025-03-20] Version 1.24.1
---------------------------
**Library - Chore**
- [PR #265](https://github.com/twilio/twilio-go/pull/265): update go versions. Thanks to [@manisha1997](https://github.com/manisha1997)!

**Accounts**
- Update Safelist API docs as part of prefix supoort

**Flex**
- Removing `first_name`, `last_name`, and `friendly_name` from the Flex User API

**Messaging**
- Add missing tests under transaction/phone_numbers and transaction/short_code


[2025-03-11] Version 1.24.0
---------------------------
**Api**
- Add the missing `emergency_enabled` field for `Address Service` endpoints

**Messaging**
- Add missing enums for A2P and TF

**Numbers**
- add missing enum values to hosted_number_order_status

**Twiml**
- Convert Twiml Attribute `speechModel` of type enum to string **(breaking change)**

**DataType Changes**
- Some attributes in multiple APIs has changed from Dictionary to Object **(breaking change)**. Please refer to the [API documentation](https://github.com/twilio/twilio-oai]) for more details.


[2025-02-20] Version 1.23.13
----------------------------
**Flex**
- Adding Digital Transfers APIs under v1/Interactions

**Numbers**
- Convert webhook_type to ienum type in v1/Porting/Configuration/Webhook/{webhook_type}

**Trusthub**
- Changing TrustHub SupportingDocument status enum from lowercase to uppercase since kyc-orch returns status capitalized and rest proxy requires strict casing


[2025-02-11] Version 1.23.12
----------------------------
**Api**
- Change downstream url and change media type for file `base/api/v2010/validation_request.json`.

**Intelligence**
- Add json_results for Generative JSON operator results

**Messaging**
- Add DestinationAlphaSender API to support Country-Specific Alpha Senders

**Video**
- Change codec type from enum to case-insensitive enum in recording and room_recording apis


[2025-01-28] Version 1.23.11
----------------------------
**Api**
- Add open-api file tag to `conference/call recordings` and `recording_transcriptions`.

**Events**
- Add support for subaccount subscriptions (beta)

**Insights**
- add new region to conference APIs

**Lookups**
- Add new `parnter_sub_id` query parameter to the lookup request


[2025-01-13] Version 1.23.10
----------------------------
**Messaging**
- Adds validity period Default value in service resource documentation


[2025-01-09] Version 1.23.9
---------------------------
**Numbers**
- Change beta feature flag to use v2/BulkHostedNumberOrders


[2024-12-12] Version 1.23.8
---------------------------
**Library - Chore**
- [PR #257](https://github.com/twilio/twilio-go/pull/257): pass query params in delete. Thanks to [@tiwarishubham635](https://github.com/tiwarishubham635)!


[2024-12-05] Version 1.23.7
---------------------------
**Api**
- Add optional parameter `intelligence_service` to `transcription`
- Updated `phone_number_sid` to be populated for sip trunking terminating calls.

**Numbers**
- Add Update Hosted Number Order V2 API endpoint
- Update Port in docs

**Twiml**
- Add optional parameter `intelligence_service` to `<Transcription>`
- Add support for new `<ConversationRelay>` and `<Assistant>` noun
- Add `events` attribute to `<Dial>` verb


[2024-11-15] Version 1.23.6
---------------------------
**Api**
- Added `ivr-virtual-agent-custom-voices` and `ivr-virtual-agent-genai` to `usage_record` API.
- Add open-api file tag to realtime_transcriptions

**Taskrouter**
- Add `api-tag` property to workers reservation
- Add `api-tag` property to task reservation


[2024-10-24] Version 1.23.5
---------------------------
**Conversations**
- Expose ConversationWithParticipants resource that allows creating a conversation with participants


[2024-10-17] Version 1.23.4
---------------------------
**Api**
- Add response key `country` to fetch AvailablePhoneNumber resource by specific country.

**Messaging**
- Make library and doc public for requestManagedCert Endpoint


[2024-10-03] Version 1.23.3
---------------------------
**Messaging**
- Add A2P external campaign CnpMigration flag

**Numbers**
- Add address sid to portability API

**Verify**
- Add `SnaClientToken` optional parameter on Verification check.
- Add `EnableSnaClientToken` optional parameter for Verification creation.


[2024-09-25] Version 1.23.2
---------------------------
**Accounts**
- Update docs and mounts.
- Change library visibility to public
- Enable consent and contact bulk upsert APIs in prod.

**Serverless**
- Add is_plugin parameter in deployments api to check if it is plugins deployment


[2024-09-18] Version 1.23.1
---------------------------
**Library - Fix**
- [PR #256](https://github.com/twilio/twilio-go/pull/256): reverting go imports to previous version. Thanks to [@AsabuHere](https://github.com/AsabuHere)!

**Intelligence**
- Remove public from operator_type
- Update operator_type to include general-availablity and deprecated

**Numbers**
- Remove beta flag for bundle clone API


[2024-09-05] Version 1.23.0
---------------------------
**Iam**
- updated library_visibility public for new public apikeys

**Numbers**
- Add new field in Error Codes for Regulatory Compliance.
- Change typing of Port In Request date_created field to date_time instead of date **(breaking change)**


[2024-08-26] Version 1.22.4
---------------------------
**Api**
- Update documentation of `error_code` and `error_message` on the Message resource.
- Remove generic parameters from `transcription` resource
- Added public documentation for Payload Data retrieval API

**Flex**
- Adding update Flex User api

**Insights**
- Added 'branded', 'business_profile' and 'voice_integrity' fields in List Call Summary

**Intelligence**
- Add `words` array information to the Sentences v2 entity.
- Add `X-Rate-Limit-Limit`, `X-Rate-Limit-Remaining`, and `X-Rate-Limit-Config` headers for Operator Results.
- Change the path parameter when fetching an `/OperatorType/{}` from `sid<EY>` to `string` to support searching by SID or by name
- Add `X-Rate-Limit-Limit`, `X-Rate-Limit-Remaining`, and `X-Rate-Limit-Config` headers for Transcript and Service endpoints.

**Messaging**
- Adds two new channel senders api to add/remove channel senders to/from a messaging service
- Extend ERC api to accept an optional attribute in request body to indicate CNP migration for an ERC

**Numbers**
- Modify visibility to public in bundle clone API
- Add `port_date` field to Port In Request and Port In Phone Numbers Fetch APIs
- Change properties docs for port in phone numbers api
- Add is_test body param to the Bundle Create API
- Change properties docs for port in api

**Trusthub**
- Add new field in themeSetId in compliance_inquiry.

**Verify**
- Update `custom_code_enabled` description on verification docs


[2024-07-02] Version 1.22.3
---------------------------
**Intelligence**
- Deprecate account flag api.twilio-intelligence.v2


[2024-06-27] Version 1.22.2
---------------------------
**Library - Chore**
- [PR #253](https://github.com/twilio/twilio-go/pull/253): updated changelog. Thanks to [@tiwarishubham635](https://github.com/tiwarishubham635)!
- [PR #252](https://github.com/twilio/twilio-go/pull/252): retract v1.22.0 due to known bug. Thanks to [@tiwarishubham635](https://github.com/tiwarishubham635)!
- [PR #249](https://github.com/twilio/twilio-go/pull/249): remove duplicate setting of header params. Thanks to [@tiwarishubham635](https://github.com/tiwarishubham635)!

**Api**
- Add `transcription` resource
- Add beta feature request managed cert

**Flex**
- Changed mount name for flex_team v2 api

**Intelligence**
- Add `X-Rate-Limit-Limit`, `X-Rate-Limit-Remaining`, and `X-Rate-Limit-Config` as Response Headers to Operator resources

**Numbers**
- Added include_constraints query parameter to the Regulations API

**Twiml**
- Add support for `<Transcription>` noun


[2024-06-25] Version 1.22.1
---------------------------
**Library - Chore**
- [PR #252](https://github.com/twilio/twilio-go/pull/252): retract v1.22.0 due to known bug. Thanks to [@tiwarishubham635](https://github.com/tiwarishubham635)!

[2024-06-18] Version 1.22.0
---------------------------
**Events**
- Add `status` and `documentation_url` to Event Types

**Lookups**
- Removed unused `fraud` lookups in V1 only to facilitate rest proxy migration

**Numbers**
- Add date_created field to the Get Port In Request API
- Rename the `status_last_time_updated_timestamp` field to `last_updated` in the Get Port In Phone Number API **(breaking change)**
- Add Rejection reason and rejection reason code to the Get Port In Phone Number API
- Remove the carrier information from the Portability API

**Proxy**
- Change property `type` from enum to ienum

**Trusthub**
- Add skipMessagingUseCase field in compliance_tollfree_inquiry.


[2024-06-06] Version 1.21.1
---------------------------
**Api**
- Mark MaxPrice as obsolete

**Lookups**
- Update examples for `phone_number_quality_score`

**Messaging**
- List tollfree verifications on parent account and all sub-accounts


[2024-05-24] Version 1.21.0
---------------------------
**Library - Chore**
- [PR #245](https://github.com/twilio/twilio-go/pull/245): added put method support. Thanks to [@sbansla](https://github.com/sbansla)!

**Library - Fix**
- [PR #246](https://github.com/twilio/twilio-go/pull/246): added body param in mock_client. Thanks to [@tiwarishubham635](https://github.com/tiwarishubham635)!

**Api**
- Add ie1 as supported region for UserDefinedMessage and UserDefinedMessageSubscription.

**Flex**
- Adding validated field to `plugin_versions`
- Corrected the data type for `runtime_domain`, `call_recording_webhook_url`, `crm_callback_url`, `crm_fallback_url`, `flex_url` in Flex Configuration
- Making `routing` optional in Create Interactions endpoint

**Intelligence**
- Expose operator authoring apis to public visibility
- Deleted `language_code` parameter from updating service in v2 **(breaking change)**
- Add read_only_attached_operator_sids to v2 services

**Numbers**
- Add API endpoint for GET Porting Webhook Configurations By Account SID
- Remove bulk portability api under version `/v1`. **(breaking change)**
- Removed porting_port_in_fetch.json files and move the content into porting_port_in.json files
- Add API endpoint to deleting Webhook Configurations
- Add Get Phone Number by Port in request SID and Phone Number SID api
- Add Create Porting webhook configuration API
- Added bundle_sid and losing_carrier_information fields to Create PortInRequest api to support Japan porting

**Taskrouter**
- Add back `routing_target` property to tasks
- Add back `ignore_capacity` property to tasks
- Removing `routing_target` property to tasks due to revert
- Removing `ignore_capacity` property to tasks due to revert
- Add `routing_target` property to tasks
- Add `ignore_capacity` property to tasks

**Trusthub**
- Add new field errors to bundle as part of public API response in customer_profile.json and trust_product.json **(breaking change)**
- Add themeSetId field in compliance_tollfree_inquiry.

**Verify**
- Update `friendly_name` description on service docs


[2024-04-18] Version 1.20.1
---------------------------
**Flex**
- Add header `ui_version` to `web_channels` API

**Messaging**
- Redeploy after failed pipeline

**Numbers**
- Add Delete Port In request phone number api and Add Delete Port In request api


[2024-04-04] Version 1.20.0
---------------------------
**Library - Feature**
- [PR #239](https://github.com/twilio/twilio-go/pull/239): added support for application/json content type in request body. Thanks to [@tiwarishubham635](https://github.com/tiwarishubham635)!

**Api**
- Correct conference filtering by date_created and date_updated documentation, clarifying that times are UTC.

**Flex**
- Remove optional parameter from `plugins` and it to `plugin_versions`

**Lookups**
- Add new `pre_fill` package to the lookup response

**Messaging**
- Cleanup api.messaging.next-gen from Messaging Services endpoints
- Readd Sending-Window after fixing test failure

**Verify**
- Add `whatsapp.msg_service_sid` and `whatsapp.from` parameters to create, update, get and list of services endpoints

**Voice**
- Correct conference filtering by date_created and date_updated documentation, clarifying that times are UTC.

**Twiml**
- Add new `token_type` value `payment-method` for `Pay` verb


[2024-04-01] Version 1.19.1
---------------------------
**Library - Chore**
- [PR #238](https://github.com/twilio/twilio-go/pull/238): Merge '2.0.0-rc' to 'main'. Thanks to [@tiwarishubham635](https://github.com/tiwarishubham635)!
- [PR #241](https://github.com/twilio/twilio-go/pull/241): Revert "feat!: Merge '2.0.0-rc' to main". Thanks to [@tiwarishubham635](https://github.com/tiwarishubham635)!

**Api**
- Add property `queue_time` to conference participant resource
- Update RiskCheck documentation
- Correct call filtering by start and end time documentation, clarifying that times are UTC.
- Correct precedence documentation for application_sid vs status_callback in message creation
- Mark MaxPrice as deprecated

**Flex**
- Adding optional parameter to `plugins`
- Making `plugins` visibility to public

**Media**
- Remove API: MediaProcessor

**Messaging**
- Remove Sending-Window due to test failure
- Add Sending-Window as a response property to Messaging Services, gated by a beta feature flag
- Add new `errors` attribute to the Brand Registration resource.
- Mark `brand_feedback` attribute as deprecated.
- Mark `failure_reason` attribute as deprecated.
- The new `errors` attribute is expected to provide additional information about Brand registration failures and feedback (if any has been provided by The Campaign Registry). Consumers should use this attribute instead of `brand_feedback` and `failure_reason`.

**Numbers**
- Correct valid_until_date field to be visible in Bundles resource
- Adding port_in_status field to the Port In resource and phone_number_status and sid fields to the Port In Phone Number resource
- Correcting mount_name for porting port in fetch API

**Oauth**
- Modified token endpoint response
- Added refresh_token and scope as optional parameter to token endpoint
- Add new APIs for vendor authorize and token endpoints

**Trusthub**
- Add update inquiry endpoint in compliance_registration.
- Add new field in themeSetId in compliance_registration.
- Add new field in statusCallbackUrl in compliance_registration.
- Add new field in isvRegisteringForSelfOrTenant in compliance_registration.

**Voice**
- Correct call filtering by start and end time documentation, clarifying that times are UTC.

**Twiml**
- Add support for new Google voices (Q1 2024) for `Say` verb - gu-IN voices
- Add support for new Amazon Polly and Google voices (Q1 2024) for `Say` verb - Niamh (en-IE) and Sofie (da-DK) voices
- Expanded description of Action parameter for Message verb


[2024-02-27] Version 1.19.0
---------------------------
**Library - Chore**
- [PR #230](https://github.com/twilio/twilio-go/pull/230): cluster tests enabled. Thanks to [@sbansla](https://github.com/sbansla)!

**Api**
- remove feedback and feedback summary from call resource

**Flex**
- Adding `routing_properties` to Interactions Channels Participant

**Lookups**
- Add new `line_status` package to the lookup response
- Remove `live_activity` package from the lookup response **(breaking change)**

**Messaging**
- Add tollfree multiple rejection reasons response array

**Trusthub**
- Add ENUM for businessRegistrationAuthority in compliance_registration. **(breaking change)**
- Add new field in isIsvEmbed in compliance_registration.
- Add additional optional fields in compliance_registration for Individual business type.

**Twiml**
- Add support for new Amazon Polly and Google voices (Q1 2024) for `Say` verb


[2024-02-09] Version 1.18.0
---------------------------
**Library - Fix**
- [PR #228](https://github.com/twilio/twilio-go/pull/228): added validation check for user credentials. Thanks to [@tiwarishubham635](https://github.com/tiwarishubham635)!

**Api**
- Updated service base url for connect apps and authorized connect apps APIs **(breaking change)**
- Update documentation to reflect RiskCheck GA
- Added optional parameter `CallToken` for create participant api

**Events**
- Marked as GA

**Flex**
- Adding `flex_instance_sid` to Flex Configuration
- Adding `provisioning_status` for Email Manager
- Adding `offline_config` to Flex Configuration

**Insights**
- add flag to restrict access to unapid customers
- decommission voice-qualitystats-endpoint role

**Intelligence**
- Add text-generation operator (for example conversation summary) results to existing OperatorResults collection.

**Lookups**
- Remove `carrier` field from `sms_pumping_risk` and leave `carrier_risk_category` **(breaking change)**
- Remove carrier information from call forwarding package **(breaking change)**

**Messaging**
- Add update instance endpoints to us_app_to_person api
- Add tollfree edit_allowed and edit_reason fields
- Update Phone Number, Short Code, Alpha Sender, US A2P and Channel Sender documentation
- Add DELETE support to Tollfree Verification resource

**Numbers**
- Add Get Port In request api

**Push**
- Migrated to new Push API V4 with Resilient Notification Delivery.

**Serverless**
- Add node18 as a valid Build runtime

**Taskrouter**
- Add `jitter_buffer_size` param in update reservation
- Add container attribute to task_queue_bulk_real_time_statistics endpoint
- Remove beta_feature check on task_queue_bulk_real_time_statistics endpoint

**Trusthub**
- Add optional field NotificationEmail to the POST /v1/ComplianceInquiries/Customers/Initialize API
- Add additional optional fields in compliance_tollfree_inquiry.json
- Rename did to tollfree_phone_number in compliance_tollfree_inquiry.json
- Add new optional field notification_email to compliance_tollfree_inquiry.json

**Verify**
- `Tags` property added again to Public Docs **(breaking change)**
- Remove `Tags` from Public Docs **(breaking change)**
- Add `VerifyEventSubscriptionEnabled` parameter to service create and update endpoints.
- Add `Tags` optional parameter on Verification creation.
- Update Verify TOTP maturity to GA.


[2024-01-25] Version 1.17.0
---------------------------
**Oauth**
- updated openid discovery endpoint uri **(breaking change)**
- Added device code authorization endpoint
- added oauth JWKS endpoint
- Get userinfo resource
- OpenID discovery resource
- Add new API for token endpoint


[2024-01-14] Version 1.16.1
---------------------------
**Library - Chore**
- [PR #218](https://github.com/twilio/twilio-go/pull/218): added versions file. Thanks to [@sbansla](https://github.com/sbansla)!

**Push**
- Migrated to new Push API V4 with Resilient Notification Delivery.


[2023-12-14] Version 1.16.0
---------------------------
**Api**
- Updated service base url for connect apps and authorized connect apps APIs **(breaking change)**

**Events**
- Marked as GA

**Insights**
- decommission voice-qualitystats-endpoint role

**Numbers**
- Add Get Port In request api

**Taskrouter**
- Add `jitter_buffer_size` param in update reservation

**Trusthub**
- Add additional optional fields in compliance_tollfree_inquiry.json

**Verify**
- Remove `Tags` from Public Docs **(breaking change)**


[2023-12-01] Version 1.15.3
---------------------------
**Verify**
- Add `VerifyEventSubscriptionEnabled` parameter to service create and update endpoints.


[2023-11-17] Version 1.15.2
---------------------------
**Api**
- Update documentation to reflect RiskCheck GA

**Messaging**
- Add tollfree edit_allowed and edit_reason fields
- Update Phone Number, Short Code, Alpha Sender, US A2P and Channel Sender documentation

**Taskrouter**
- Add container attribute to task_queue_bulk_real_time_statistics endpoint

**Trusthub**
- Rename did to tollfree_phone_number in compliance_tollfree_inquiry.json
- Add new optional field notification_email to compliance_tollfree_inquiry.json

**Verify**
- Add `Tags` optional parameter on Verification creation.


[2023-11-06] Version 1.15.1
---------------------------
**Flex**
- Adding `provisioning_status` for Email Manager

**Intelligence**
- Add text-generation operator (for example conversation summary) results to existing OperatorResults collection.

**Messaging**
- Add DELETE support to Tollfree Verification resource

**Serverless**
- Add node18 as a valid Build runtime

**Verify**
- Update Verify TOTP maturity to GA.


[2023-10-19] Version 1.15.0
---------------------------
**Accounts**
- Updated Safelist metadata to correct the docs.
- Add Global SafeList API changes

**Api**
- Added optional parameter `CallToken` for create participant api

**Flex**
- Adding `offline_config` to Flex Configuration

**Intelligence**
- Deleted `redacted` parameter from fetching transcript in v2 **(breaking change)**

**Lookups**
- Add new `phone_number_quality_score` package to the lookup response
- Remove `disposable_phone_number_risk` package **(breaking change)**

**Messaging**
- Update US App To Person documentation with current `message_samples` requirements

**Taskrouter**
- Remove beta_feature check on task_queue_bulk_real_time_statistics endpoint
- Add `virtual_start_time` property to tasks
- Updating `task_queue_data` format from `map` to `array` in the response of bulk get endpoint of TaskQueue Real Time Statistics API **(breaking change)**


[2023-10-05] Version 1.14.1
---------------------------
**Library - Chore**
- [PR #211](https://github.com/twilio/twilio-go/pull/211): twilio help changes. Thanks to [@kridai](https://github.com/kridai)!

**Lookups**
- Add test api support for Lookup v2


[2023-09-21] Version 1.14.0
---------------------------
**Conversations**
- Enable conversation email bindings, email address configurations and email message subjects

**Flex**
- Adding `console_errors_included` to Flex Configuration field `debugger_integrations`
- Introducing new channel status as `inactive` in modify channel endpoint for leave functionality **(breaking change)**
- Adding `citrix_voice_vdi` to Flex Configuration

**Taskrouter**
- Add Update Queues, Workers, Workflow Real Time Statistics API to flex-rt-data-api-v2 endpoint
- Add Update Workspace Real Time Statistics API to flex-rt-data-api-v2 endpoint


[2023-09-07] Version 1.13.0
---------------------------
**Api**
- Make message tagging parameters public **(breaking change)**

**Flex**
- Adding `agent_conv_end_methods` to Flex Configuration

**Messaging**
- Mark Mesasging Services fallback_to_long_code feature obsolete

**Numbers**
- Add Create Port In request api
- Renaming sid for bulk_hosting_sid and remove account_sid response field in numbers/v2/BulkHostedNumberOrders **(breaking change)**

**Pricing**
- gate resources behind a beta_feature


[2023-08-24] Version 1.12.0
---------------------------
**Api**
- Add new property `RiskCheck` for SMS pumping protection feature only (public beta to be available soon): Include this parameter with a value of `disable` to skip any kind of risk check on the respective message request

**Flex**
- Changing `sid<UO>` path param to `sid<UT>` in interaction channel participant update endpoint **(breaking change)**

**Messaging**
- Add Channel Sender api
- Fixing country code docs and removing Zipwhip references

**Numbers**
- Request status changed in numbers/v2/BulkHostedNumberOrders **(breaking change)**
- Add bulk hosting orders API under version `/v2


[2023-08-10] Version 1.11.0
---------------------------
**Insights**
- Normalize annotations parameters in list summary api to be prefixed

**Numbers**
- Change Bulk_hosted_sid from BHR to BH prefix in HNO and dependent under version `/v2` API's. **(breaking change)**
- Added parameter target_account_sid to portability and account_sid to response body

**Verify**
- Remove beta feature flag to list attempts API.
- Remove beta feature flag to verifications summary attempts API.


[2023-07-27] Version 1.10.1
---------------------------
**Api**
- Added `voice-intelligence`, `voice-intelligence-transcription` and `voice-intelligence-operators` to `usage_record` API.
- Added `tts-google` to `usage_record` API.

**Lookups**
- Add new `disposable_phone_number_risk` package to the lookup response

**Verify**
- Documentation of list attempts API was improved by correcting `date_created_after` and `date_created_before` expected date format.
- Documentation was improved by correcting `date_created_after` and `date_created_before` expected date format parameter on attempts summary API.
- Documentation was improved by adding `WHATSAPP` as optional valid parameter on attempts summary API.

**Twiml**
- Added support for he-il inside of ssm_lang.json that was missing
- Added support for he-il language in say.json that was missing
- Add `statusCallback` and `statusCallbackMethod` attributes to `<Siprec>`.


[2023-07-13] Version 1.10.0
---------------------------
**Flex**
- Adding `interaction_context_sid` as optional parameter in Interactions API

**Messaging**
- Making visiblity public for tollfree_verification API

**Numbers**
- Remove Sms capability property from HNO creation under version `/v2` of HNO API. **(breaking change)**
- Update required properties in LOA creation under version `/v2` of Authorization document API. **(breaking change)**

**Taskrouter**
- Add api to fetch task queue statistics for multiple TaskQueues

**Verify**
- Add `RiskCheck` optional parameter on Verification creation.

**Twiml**
- Add Google Voices and languages


[2023-06-28] Version 1.9.0
--------------------------
**Lookups**
- Add `reassigned_number` package to the lookup response

**Numbers**
- Add hosted_number_order under version `/v2`.
- Update properties in Porting and Bulk Porting APIs. **(breaking change)**
- Added bulk Portability API under version `/v1`.
- Added Portability API under version `/v1`.


[2023-06-15] Version 1.8.0
--------------------------
**Api**
- Added `content_sid` as conditional parameter
- Removed `content_sid` as optional field **(breaking change)**

**Insights**
- Added `annotation` to list summary output


[2023-06-01] Version 1.7.2
--------------------------
**Api**
- Add `Trim` to create Conference Participant API

**Intelligence**
- First public beta release for Voice Intelligence APIs with client libraries

**Messaging**
- Add new `errors` attribute to us_app_to_person resource. This attribute will provide additional information about campaign registration errors.


[2023-05-18] Version 1.7.1
--------------------------
**Conversations**
- Added  `AddressCountry` parameter to Address Configuration endpoint, to support regional short code addresses
- Added query parameters `start_date`, `end_date` and `state` in list Conversations resource for filtering

**Insights**
- Added annotations parameters to list summary api

**Messaging**
- Add GET domainByMessagingService endpoint to linkShortening service
- Add `disable_https` to link shortening domain_config properties

**Numbers**
- Add bulk_eligibility api under version `/v1`.


[2023-05-04] Version 1.7.0
--------------------------
**Conversations**
- Remove `start_date`, `end_date` and `state` query parameters from list operation on Conversations resource **(breaking change)**

**Twiml**
- Add support for new Amazon Polly voices (Q1 2023) for `Say` verb


[2023-04-19] Version 1.6.0
--------------------------
**Library - Docs**
- [PR #204](https://github.com/twilio/twilio-go/pull/204): consolidate. Thanks to [@stern-shawn](https://github.com/stern-shawn)!

**Messaging**
- Remove `messaging_service_sids` and `messaging_service_sid_action` from domain config endpoint **(breaking change)**
- Add error_code and rejection_reason properties to tollfree verification API response

**Numbers**
- Added the new Eligibility API under version `/v1`.


[2023-04-05] Version 1.5.0
--------------------------
**Conversations**
- Expose query parameters `start_date`, `end_date` and `state` in list operation on Conversations resource for sorting and filtering

**Insights**
- Added answered by filter in Call Summaries

**Lookups**
- Remove `disposable_phone_number_risk` package **(breaking change)**

**Messaging**
- Add support for `SOLE_PROPRIETOR` brand type and `SOLE_PROPRIETOR` campaign use case.
- New Sole Proprietor Brands should be created with `SOLE_PROPRIETOR` brand type. Brand registration requests with `STARTER` brand type will be rejected.
- New Sole Proprietor Campaigns should be created with `SOLE_PROPRIETOR` campaign use case. Campaign registration requests with `STARTER` campaign use case will be rejected.
- Add Brand Registrations OTP API


[2023-03-22] Version 1.4.0
--------------------------
**Api**
- Revert Corrected the data type for `friendly_name` in Available Phone Number Local, Mobile and TollFree resources
- Corrected the data type for `friendly_name` in Available Phone Number Local, Mobile and TollFree resources **(breaking change)**

**Messaging**
- Add `linkshortening_messaging_service` resource
- Add new endpoint for GetDomainConfigByMessagingServiceSid
- Remove `validated` parameter and add `cert_in_validation` parameter to Link Shortening API **(breaking change)**


[2023-03-09] Version 1.3.5
--------------------------
**Library - Chore**
- [PR #203](https://github.com/twilio/twilio-go/pull/203): drop generated ignore files. Thanks to [@childish-sambino](https://github.com/childish-sambino)!

**Api**
- Add new categories for whatsapp template

**Lookups**
- Remove `validation_results` from the `default_output_properties`

**Supersim**
- Add ESimProfile's `matching_id` and `activation_code` parameters to libraries


[2023-02-22] Version 1.3.4
--------------------------
**Api**
- Remove `scheduled_for` property from message resource
- Add `scheduled_for` property to message resource


[2023-02-08] Version 1.3.3
--------------------------
**Lookups**
- Add `disposable_phone_number_risk` package to the lookup response
- Add `sms_pumping_risk` package to the lookup response


[2023-01-25] Version 1.3.2
--------------------------
**Library - Docs**
- [PR #202](https://github.com/twilio/twilio-go/pull/202): use long property descriptions if available. Thanks to [@childish-sambino](https://github.com/childish-sambino)!

**Library - Fix**
- [PR #199](https://github.com/twilio/twilio-go/pull/199): Nullable Page URLs. Thanks to [@claudiachua](https://github.com/claudiachua)!

**Api**
- Add `public_application_connect_enabled` param to Application resource

**Messaging**
- Add new tollfree verification API property (ExternalReferenceId)]

**Verify**
- Add `device_ip` parameter and channel `auto` for sna/sms orchestration

**Twiml**
- Add support for `<Application>` noun and `<ApplicationSid>` noun, nested `<Parameter>` to `<Hangup>` and `<Leave>` verb


[2023-01-11] Version 1.3.1
--------------------------
**Conversations**
- Add support for creating Multi-Channel Rich Content Messages

**Lookups**
- Changed the no data message for match postal code from `no_data` to `data_not_available` in identity match package

**Messaging**
- Add update/edit tollfree verification API


[2022-12-14] Version 1.3.0
--------------------------
**Api**
- Add `street_secondary` param to address create and update
- Make `method` optional for user defined message subscription **(breaking change)**

**Flex**
- Flex Conversations is now Generally Available
- Adding the ie1 mapping for authorization api, updating service base uri and base url response attribute **(breaking change)**
- Change web channels to GA and library visibility to public
- Changing the uri for authorization api from using Accounts to Insights **(breaking change)**

**Media**
- Gate Twilio Live endpoints behind beta_feature for EOS

**Messaging**
- Mark `MessageFlow` as a required field for Campaign Creation **(breaking change)**

**Oauth**
- updated openid discovery endpoint uri **(breaking change)**
- Added device code authorization endpoint

**Supersim**
- Allow filtering the SettingsUpdates resource by `status`

**Twiml**
- Add new Polly Neural voices
- Add tr-TR, ar-AE, yue-CN, fi-FI languages to SSML `<lang>` element.
- Add x-amazon-jyutping, x-amazon-pinyin, x-amazon-pron-kana, x-amazon-yomigana alphabets to SSML `<phoneme>` element.
- Rename `character` value for SSML `<say-as>` `interpret-as` attribute to `characters`. **(breaking change)**
- Rename `role` attribute to `format` in SSML `<say-as>` element. **(breaking change)**


[2022-11-30] Version 1.2.2
--------------------------
**Flex**
- Adding new `assessments` api in version `v1`

**Lookups**
- Add `identity_match` package to the lookup response

**Messaging**
- Added `validated` parameter to Link Shortening API

**Serverless**
- Add node16 as a valid Build runtime
- Add ie1 and au1 as supported regions for all endpoints.


[2022-11-16] Version 1.2.1
--------------------------
**Library - Chore**
- [PR #198](https://github.com/twilio/twilio-go/pull/198): upgrade GitHub Actions dependencies. Thanks to [@childish-sambino](https://github.com/childish-sambino)!

**Api**
- Set the Content resource to have public visibility as Preview

**Flex**
- Adding new parameter `base_url` to 'gooddata' response in version `v1`

**Insights**
- Added `answered_by` field in List Call Summary
- Added `answered_by` field in call summary


[2022-11-10] Version 1.2.0
--------------------------
**Library - Feature**
- [PR #197](https://github.com/twilio/twilio-go/pull/197): add context.Context support. Thanks to [@natebrennand](https://github.com/natebrennand)!
- [PR #196](https://github.com/twilio/twilio-go/pull/196): introduce base client that utilizes context. Thanks to [@natebrennand](https://github.com/natebrennand)!

**Flex**
- Adding two new authorization API 'user_roles' and 'gooddata' in version `v1`

**Messaging**
- Add new Campaign properties (MessageFlow, OptInMessage, OptInKeywords, OptOutMessage, OptOutKeywords, HelpMessage, HelpKeywords)


[2022-10-31] Version 1.1.1
--------------------------
**Library - Miscellaneous**
- [PR #195](https://github.com/twilio/twilio-go/pull/195): move webhook cluster test. Thanks to [@claudiachua](https://github.com/claudiachua)!

**Api**
- Added `contentSid` and `contentVariables` to Message resource with public visibility as Beta
- Add `UserDefinedMessageSubscription` and `UserDefinedMessage` resource

**Proxy**
- Remove FailOnParticipantConflict param from Proxy Session create and update and Proxy Participant create

**Supersim**
- Update SettingsUpdates resource to remove PackageSid

**Taskrouter**
- Add `Ordering` query parameter to Workers and TaskQueues for sorting by
- Add `worker_sid` query param for list reservations endpoint


[2022-10-19] Version 1.1.0
--------------------------
**Library - Docs**
- [PR #192](https://github.com/twilio/twilio-go/pull/192): Update readme to remove pilot warning. Thanks to [@JenniferMah](https://github.com/JenniferMah)!

**Api**
- Make link shortening parameters public **(breaking change)**

**Oauth**
- added oauth JWKS endpoint
- Get userinfo resource
- OpenID discovery resource
- Add new API for token endpoint

**Supersim**
- Add SettingsUpdates resource

**Verify**
- Update Verify Push endpoints to `ga` maturity
- Verify BYOT add Channels property to the Get Templates response


[2022-10-05] Version 1.0.0
--------------------------
**Note:** This release contains breaking changes, check our [upgrade guide](./UPGRADE.md#2022-10-05-026x-to-1xx) for detailed migration notes.

**Library - Feature**
- [PR #191](https://github.com/twilio/twilio-go/pull/191): Merge 1.0.0 RC branch to main. Thanks to [@rakatyal](https://github.com/rakatyal)! **(breaking change)**
- [PR #165](https://github.com/twilio/twilio-go/pull/165): Add support for x-www-form-urlencoded requests to rv.ValidateBody. Thanks to [@heyztb](https://github.com/heyztb)!

**Library - Test**
- [PR #181](https://github.com/twilio/twilio-go/pull/181): add test-docker rule. Thanks to [@beebzz](https://github.com/beebzz)!
- [PR #172](https://github.com/twilio/twilio-go/pull/172): Adding misc as PR type. Thanks to [@rakatyal](https://github.com/rakatyal)!

**Library - Fix**
- [PR #174](https://github.com/twilio/twilio-go/pull/174): Revert "feat: Add support for x-www-form-urlencoded requests to rv.ValidateBody". Thanks to [@claudiachua](https://github.com/claudiachua)!

**Library - Chore**
- [PR #168](https://github.com/twilio/twilio-go/pull/168): use Docker 'rc' tag for release candidate images. Thanks to [@childish-sambino](https://github.com/childish-sambino)!

**Api**
- Added `virtual-agent` to `usage_record` API.
- Add AMD attributes to participant create request
- Remove `beta feature` from scheduling params and remove optimize parameters. **(breaking change)**
- Added `amazon-polly` to `usage_record` API.

**Conversations**
- Allowed to use `identity` as part of Participant's resource **(breaking change)**

**Flex**
- Removed redundant `close` status from Flex Interactions flow **(breaking change)**
- Adding `debugger_integration` and `flex_ui_status_report` to Flex Configuration
- Add `status`, `error_code`, and `error_message` fields to Interaction `Channel`
- Adding `messenger` and `gbm` as supported channels for Interactions API

**Insights**
- Added `annotation` field in call summary
- Added new endpoint to fetch/create/update Call Annotations

**Lookups**
- Remove `enhanced_line_type` from the lookup response **(breaking change)**
- Adding support for Lookup V2 API

**Messaging**
- Add create, list and get tollfree verification API
- Update alpha_sender docs with new valid characters

**Routes**
- Remove Duplicate Create Method - Update Method will work even if Inbound Processing Region is currently empty/404. **(breaking change)**
- Inbound Proccessing Region API - Public GA

**Studio**
- Corrected PII labels to be 30 days and added context to be PII

**Supersim**
- Allow updating `DataLimit` on a Fleet
- Add support for `sim_ip_addresses` resource to helper libraries

**Verify**
- Verify SafeList API endpoints added.
- Reorder Verification Check parameters so `code` stays as the first parameter **(breaking change)**
- Rollback List Attempts API V2 back to pilot stage.
- Changed summary param `service_sid` to `verify_service_sid` to be consistent with list attempts API **(breaking change)**
- Make `code` optional on Verification check to support `sna` attempts.
- Remove `api.verify.totp` beta flag and set maturity to `beta` for Verify TOTP properties and parameters. **(breaking change)**
- Changed summary param `verify_service_sid` to `service_sid` to be consistent with list attempts API **(breaking change)**

**Video**
- Add `Anonymize` API


[2022-05-18] Version 0.26.0
---------------------------
**Note:** This release contains breaking changes, check our [upgrade guide](./UPGRADE.md#2022-05-18-025x-to-026x) for detailed migration notes.

**Library - Chore**
- [PR #164](https://github.com/twilio/twilio-go/pull/164): rename ApiV2010 to Api. Thanks to [@JenniferMah](https://github.com/JenniferMah)! **(breaking change)**

**Api**
- Add property `media_url` to the recording resources

**Verify**
- Include `silent` as a channel type in the verifications API.


[2022-05-04] Version 0.25.0
---------------------------
**Library - Feature**
- [PR #162](https://github.com/twilio/twilio-go/pull/162): twilio-go stream functions also return error channel. Thanks to [@childish-sambino](https://github.com/childish-sambino)!
- [PR #158](https://github.com/twilio/twilio-go/pull/158): add unmarshaling helper for float32. Thanks to [@childish-sambino](https://github.com/childish-sambino)!

**Library - Chore**
- [PR #159](https://github.com/twilio/twilio-go/pull/159): [DI-1566] modify ua string. Thanks to [@claudiachua](https://github.com/claudiachua)!

**Conversations**
- Expose query parameter `type` in list operation on Address Configurations resource

**Supersim**
- Add `data_total_billed` and `billed_units` fields to Super SIM UsageRecords API response.
- Change ESimProfiles `Eid` parameter to optional to enable Activation Code download method support **(breaking change)**

**Verify**
- Deprecate `push.include_date` parameter in create and update service.


[2022-04-20] Version 0.24.1
---------------------------
**Library - Test**
- [PR #156](https://github.com/twilio/twilio-go/pull/156): fix type on broken cluster test. Thanks to [@childish-sambino](https://github.com/childish-sambino)!

**Library - Fix**
- [PR #155](https://github.com/twilio/twilio-go/pull/155): switch api-def object types to open-api any types. Thanks to [@childish-sambino](https://github.com/childish-sambino)!
- [PR #154](https://github.com/twilio/twilio-go/pull/154): support operations with no 2XX responses. Thanks to [@childish-sambino](https://github.com/childish-sambino)!


[2022-04-06] Version 0.24.0
---------------------------
**Library - Fix**
- [PR #153](https://github.com/twilio/twilio-go/pull/153): use go install instead of go get. Thanks to [@beebzz](https://github.com/beebzz)!

**Library - Feature**
- [PR #152](https://github.com/twilio/twilio-go/pull/152): update cluster tests authentication. Thanks to [@JenniferMah](https://github.com/JenniferMah)!
- [PR #151](https://github.com/twilio/twilio-go/pull/151): add support for Go 1.18. Thanks to [@beebzz](https://github.com/beebzz)!

**Api**
- Updated `provider_sid` visibility to private

**Verify**
- Verify List Attempts API summary endpoint added.
- Update PII documentation for `AccessTokens` `factor_friendly_name` property.

**Voice**
- make annotation parameter from /Calls API private


[2022-03-23] Version 0.23.0
---------------------------
**Library - Docs**
- [PR #150](https://github.com/twilio/twilio-go/pull/150): Renaming RestClientParams to ClientParams and updating docs examples. Thanks to [@rakatyal](https://github.com/rakatyal)!
- [PR #147](https://github.com/twilio/twilio-go/pull/147): fix the 'List*' operation return type documentation. Thanks to [@childish-sambino](https://github.com/childish-sambino)!

**Library - Fix**
- [PR #143](https://github.com/twilio/twilio-go/pull/143): handle buildUrl errors gracefully. Thanks to [@kpritam](https://github.com/kpritam)!
- [PR #148](https://github.com/twilio/twilio-go/pull/148): refactor limit enforcement and fetching next page. Thanks to [@childish-sambino](https://github.com/childish-sambino)!

**Api**
- Change `stream` url parameter to non optional
- Add `verify-totp` and `verify-whatsapp-conversations-business-initiated` categories to `usage_record` API

**Chat**
- Added v3 Channel update endpoint to support Public to Private channel migration

**Flex**
- Private Beta release of the Interactions API to support the upcoming release of Flex Conversations at the end of Q1 2022.
- Adding `channel_configs` object to Flex Configuration

**Media**
- Add max_duration param to PlayerStreamer

**Supersim**
- Remove Commands resource, use SmsCommands resource instead **(breaking change)**

**Taskrouter**
- Add limits to `split_by_wait_time` for Cumulative Statistics Endpoint

**Video**
- Change recording `status_callback_method` type from `enum` to `http_method` **(breaking change)**
- Add `status_callback` and `status_callback_method` to composition
- Add `status_callback` and `status_callback_method` to recording


[2022-03-09] Version 0.22.2
---------------------------
**Library - Chore**
- [PR #142](https://github.com/twilio/twilio-go/pull/142): push Datadog Release Metric upon deploy success. Thanks to [@eshanholtz](https://github.com/eshanholtz)!

**Api**
- Add optional boolean include_soft_deleted parameter to retrieve soft deleted recordings

**Chat**
- Add `X-Twilio-Wehook-Enabled` header to `delete` method in UserChannel resource

**Numbers**
- Expose `failure_reason` in the Supporting Documents resources

**Verify**
- Add optional `metadata` parameter to "verify challenge" endpoint, so the SDK/App can attach relevant information from the device when responding to challenges.
- remove beta feature flag to list atempt api operations.
- Add `ttl` and `date_created` properties to `AccessTokens`.


[2022-02-23] Version 0.22.1
---------------------------
**Api**
- Add `uri` to `stream` resource
- Add A2P Registration Fee category (`a2p-registration-fee`) to usage records

**Verify**
- Remove outdated documentation commentary to contact sales. Product is already in public beta.


[2022-02-17] Version 0.22.0
---------------------------
**Api**
- Detected a bug and removed optional boolean include_soft_deleted parameter to retrieve soft deleted recordings. **(breaking change)**
- Add optional boolean include_soft_deleted parameter to retrieve soft deleted recordings.

**Numbers**
- Unrevert valid_until and sort filter params added to List Bundles resource
- Revert valid_until and sort filter params added to List Bundles resource
- Update sorting params added to List Bundles resource in the previous release

**Preview**
- Moved `web_channels` from preview to beta under `flex-api` **(breaking change)**

**Taskrouter**
- Add `ETag` as Response Header to List of Task, Reservation & Worker

**Verify**
- Add optional `metadata` to factors.


[2022-02-09] Version 0.21.0
---------------------------
**Library - Chore**
- [PR #138](https://github.com/twilio/twilio-go/pull/138): upgrade supported language versions. Thanks to [@childish-sambino](https://github.com/childish-sambino)!

**Api**
- Add `stream` resource

**Conversations**
- Fixed DELETE request to accept "sid_like" params in Address Configuration resources **(breaking change)**
- Expose Address Configuration resource for `sms` and `whatsapp`

**Fax**
- Removed deprecated Programmable Fax Create and Update methods **(breaking change)**

**Insights**
- Rename `call_state` to `call_status` and remove `whisper` in conference participant summary **(breaking change)**

**Numbers**
- Expose valid_until filters as part of provisionally-approved compliance feature on the List Bundles resource

**Supersim**
- Fix typo in Fleet resource docs
- Updated documentation for the Fleet resource indicating that fields related to commands have been deprecated and to use sms_command fields instead.
- Add support for setting and reading `ip_commands_url` and `ip_commands_method` on Fleets resource for helper libraries
- Changed `sim` property in requests to create an SMS Command made to the /SmsCommands to accept SIM UniqueNames in addition to SIDs

**Verify**
- Update list attempts API to include new filters and response fields.


[2022-01-26] Version 0.20.1
---------------------------
**Insights**
- Added new endpoint to fetch Conference Participant Summary
- Added new endpoint to fetch Conference Summary

**Messaging**
- Add government_entity parameter to brand apis

**Verify**
- Add Access Token fetch endpoint to retrieve a previously created token.
- Add Access Token payload to the Access Token creation endpoint, including a unique Sid, so it's addressable while it's TTL is valid.


[2022-01-12] Version 0.20.0
---------------------------
**Library - Chore**
- [PR #135](https://github.com/twilio/twilio-go/pull/135): add sonarcloud coverage analysis. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!
- [PR #132](https://github.com/twilio/twilio-go/pull/132): remove githook dependency from make install. Thanks to [@JenniferMah](https://github.com/JenniferMah)!

**Library - Feature**
- [PR #134](https://github.com/twilio/twilio-go/pull/134): add GitHub release step during deploy. Thanks to [@childish-sambino](https://github.com/childish-sambino)!

**Api**
- Make fixed time scheduling parameters public **(breaking change)**

**Messaging**
- Add update brand registration API

**Numbers**
- Add API endpoint for List Bundle Copies resource

**Video**
- Enable external storage for all customers


[2021-12-15] Version 0.19.0
---------------------------
**Library - Feature**
- [PR #129](https://github.com/twilio/twilio-go/pull/129): run tests before deploying. Thanks to [@childish-sambino](https://github.com/childish-sambino)!

**Library - Docs**
- [PR #131](https://github.com/twilio/twilio-go/pull/131): fix whitespace issue in handling exceptions example. Thanks to [@EmFord](https://github.com/EmFord)!

**Api**
- Add optional boolean send_as_mms parameter to the create action of Message resource **(breaking change)**
- Change team ownership for `call` delete

**Conversations**
- Change wording for `Service Webhook Configuration` resource fields

**Insights**
- Added new APIs for updating and getting voice insights flags by accountSid.

**Media**
- Add max_duration param to MediaProcessor

**Video**
- Add `EmptyRoomTimeout` and `UnusedRoomTimeout` properties to a room; add corresponding parameters to room creation

**Voice**
- Add endpoint to delete archived Calls


[2021-12-01] Version 0.18.2
---------------------------
**Conversations**
- Add `Service Webhook Configuration` resource

**Flex**
- Adding `flex_insights_drilldown` and `flex_url` objects to Flex Configuration

**Messaging**
- Update us_app_to_person endpoints to remove beta feature flag based access

**Supersim**
- Add IP Commands resource

**Verify**
- Add optional `factor_friendly_name` parameter to the create access token endpoint.

**Video**
- Add maxParticipantDuration param to Rooms


[2021-11-17] Version 0.18.1
---------------------------
**Library - Chore**
- [PR #127](https://github.com/twilio/twilio-go/pull/127): consolidate workflows. Thanks to [@eshanholtz](https://github.com/eshanholtz)!
- [PR #126](https://github.com/twilio/twilio-go/pull/126): add event type cluster test. Thanks to [@JenniferMah](https://github.com/JenniferMah)!

**Library - Fix**
- [PR #124](https://github.com/twilio/twilio-go/pull/124): git log retrieval issues. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!

**Frontline**
- Added `is_available` to User's resource

**Messaging**
- Added GET vetting API

**Verify**
- Add `WHATSAPP` to the attempts API.
- Allow to update `config.notification_platform` from `none` to `apn` or `fcm` and viceversa for Verify Push
- Add `none` as a valid `config.notification_platform` value for Verify Push


[2021-11-03] Version 0.18.0
---------------------------
**Library - Fix**
- [PR #125](https://github.com/twilio/twilio-go/pull/125): remove cluster test. Thanks to [@JenniferMah](https://github.com/JenniferMah)!

**Library - Chore**
- [PR #123](https://github.com/twilio/twilio-go/pull/123): migrate to github actions from travis ci. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!

**Api**
- Updated `media_url` property to be treated as PII

**Messaging**
- Added a new enum for brand registration status named DELETED **(breaking change)**
- Add a new K12_EDUCATION use case in us_app_to_person_usecase api transaction
- Added a new enum for brand registration status named IN_REVIEW

**Serverless**
- Add node14 as a valid Build runtime

**Verify**
- Fix typos in Verify Push Factor documentation for the `config.notification_token` parameter.
- Added `TemplateCustomSubstitutions` on verification creation
- Make `TemplateSid` parameter public for Verification resource and `DefaultTemplateSid` parameter public for Service resource. **(breaking change)**


[2021-10-18] Version 0.17.0
---------------------------
**Library - Feature**
- [PR #122](https://github.com/twilio/twilio-go/pull/122): Add PlaybackGrant. Thanks to [@miguelgrinberg](https://github.com/miguelgrinberg)!

**Api**
- Corrected enum values for `emergency_address_status` values in `/IncomingPhoneNumbers` response. **(breaking change)**
- Clarify `emergency_address_status` values in `/IncomingPhoneNumbers` response.

**Messaging**
- Add PUT and List brand vettings api
- Removes beta feature flag based visibility for us_app_to_person_registered and usecase field.Updates test cases to add POLITICAL usecase. **(breaking change)**
- Add brand_feedback as optional field to BrandRegistrations

**Video**
- Add `AudioOnly` to create room


[2021-10-06] Version 0.16.0
---------------------------
**Library - Fix**
- [PR #121](https://github.com/twilio/twilio-go/pull/121): parameter casing with numbers. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!

**Api**
- Add `emergency_address_status` attribute to `/IncomingPhoneNumbers` response.
- Add `siprec` resource

**Conversations**
- Added attachment parameters in configuration for `NewMessage` type of push notifications

**Flex**
- Adding `flex_insights_hr` object to Flex Configuration

**Numbers**
- Add API endpoint for Bundle ReplaceItems resource
- Add API endpoint for Bundle Copies resource

**Serverless**
- Add domain_base field to Service response

**Taskrouter**
- Add `If-Match` Header based on ETag for Worker Delete **(breaking change)**
- Add `If-Match` Header based on Etag for Reservation Update
- Add `If-Match` Header based on ETag for Worker Update
- Add `If-Match` Header based on ETag for Worker Delete
- Add `ETag` as Response Header to Worker

**Trunking**
- Added `transfer_caller_id` property on Trunks.

**Verify**
- Document new pilot `whatsapp` channel.


[2021-09-22] Version 0.15.0
---------------------------
**Library - Feature**
- [PR #116](https://github.com/twilio/twilio-go/pull/116): add jwt token signing and verification logic. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!

**Library - Test**
- [PR #117](https://github.com/twilio/twilio-go/pull/117): increase Client test coverage. Thanks to [@eshanholtz](https://github.com/eshanholtz)!

**Events**
- Add segment sink

**Messaging**
- Add post_approval_required attribute in GET us_app_to_person_usecase api response
- Add Identity Status, Russell 3000, Tax Exempt Status and Should Skip SecVet fields for Brand Registrations
- Add Should Skip Secondary Vetting optional flag parameter to create Brand API


[2021-09-08] Version 0.14.2
---------------------------
**Library - Fix**
- [PR #115](https://github.com/twilio/twilio-go/pull/115): typo in page function. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!

**Api**
- Revert adding `siprec` resource
- Add `siprec` resource

**Messaging**
- Add 'mock' as an optional field to brand_registration api
- Add 'mock' as an optional field to us_app_to_person api
- Adds more Use Cases in us_app_to_person_usecase api transaction and updates us_app_to_person_usecase docs

**Verify**
- Verify List Templates API endpoint added.


[2021-08-25] Version 0.14.1
---------------------------
**Api**
- Add Programmabled Voice SIP Refer call transfers (`calls-transfers`) to usage records
- Add Flex Voice Usage category (`flex-usage`) to usage records

**Conversations**
- Add `Order` query parameter to Message resource read operation

**Insights**
- Added `partial` to enum processing_state_request
- Added abnormal session filter in Call Summaries

**Messaging**
- Add brand_registration_sid as an optional query param for us_app_to_person_usecase api

**Pricing**
- add trunking_numbers resource (v2)
- add trunking_country resource (v2)

**Verify**
- Changed to private beta the `TemplateSid` optional parameter on Verification creation.
- Added the optional parameter `Order` to the list Challenges endpoint to define the list order.


[2021-08-11] Version 0.14.0
---------------------------
**Library - Fix**
- [PR #110](https://github.com/twilio/twilio-go/pull/110): pagination with next_page_url. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!

**Library - Chore**
- [PR #108](https://github.com/twilio/twilio-go/pull/108): shorten generated model names. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!
- [PR #106](https://github.com/twilio/twilio-go/pull/106): integrate with sonarcloud. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!

**Api**
- Corrected the `price`, `call_sid_to_coach`, and `uri` data types for Conference, Participant, and Recording **(breaking change)**
- Made documentation for property `time_limit` in the call api public. **(breaking change)**
- Added `domain_sid` in sip_credential_list_mapping and sip_ip_access_control_list_mapping APIs **(breaking change)**

**Insights**
- Added new endpoint to fetch Call Summaries

**Messaging**
- Add brand_type field to a2p brand_registration api
- Revert brand registration api update to add brand_type field
- Add brand_type field to a2p brand_registration api

**Taskrouter**
- Add `X-Rate-Limit-Limit`, `X-Rate-Limit-Remaining`, and `X-Rate-Limit-Config` as Response Headers to all TaskRouter endpoints

**Verify**
- Add `TemplateSid` optional parameter on Verification creation.
- Include `whatsapp` as a channel type in the verifications API.


[2021-07-28] Version 0.13.0
---------------------------
**Library - Feature**
- [PR #105](https://github.com/twilio/twilio-go/pull/105): publish go docker image. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!
- [PR #92](https://github.com/twilio/twilio-go/pull/92): add pagination. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)! **(breaking change)**
- [PR #100](https://github.com/twilio/twilio-go/pull/100): add cluster testing. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!
- [PR #96](https://github.com/twilio/twilio-go/pull/96): Twilio Signature Validation. Thanks to [@pmcanseco](https://github.com/pmcanseco)!
- [PR #95](https://github.com/twilio/twilio-go/pull/95): support env var loading of API credentials. Thanks to [@eshanholtz](https://github.com/eshanholtz)!

**Library - Test**
- [PR #103](https://github.com/twilio/twilio-go/pull/103): add edge case tests. Thanks to [@eshanholtz](https://github.com/eshanholtz)!

**Library - Fix**
- [PR #102](https://github.com/twilio/twilio-go/pull/102): list of stringified json marshaling. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!
- [PR #99](https://github.com/twilio/twilio-go/pull/99): add nil check. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!

**Library - Chore**
- [PR #101](https://github.com/twilio/twilio-go/pull/101): refactor list params to include 'limit'. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!

**Library - Docs**
- [PR #97](https://github.com/twilio/twilio-go/pull/97): add pagination docs. Thanks to [@eshanholtz](https://github.com/eshanholtz)!

**Conversations**
- Expose ParticipantConversations resource

**Taskrouter**
- Adding `links` to the activity resource

**Verify**
- Added a `Version` to Verify Factors `Webhooks` to add new fields without breaking old Webhooks.


[2021-07-14] Version 0.12.0
---------------------------
**Library - Fix**
- [PR #93](https://github.com/twilio/twilio-go/pull/93): list of stringified json marshaling. Thanks to [@eshanholtz](https://github.com/eshanholtz)!

**Conversations**
- Changed `last_read_message_index` and `unread_messages_count` type in User Conversation's resource **(breaking change)**
- Expose UserConversations resource

**Messaging**
- Add brand_score field to brand registration responses


[2021-06-30] Version 0.11.0
---------------------------
**Library - Fix**
- [PR #91](https://github.com/twilio/twilio-go/pull/91): revert client submodule creation. Thanks to [@childish-sambino](https://github.com/childish-sambino)!

**Library - Feature**
- [PR #90](https://github.com/twilio/twilio-go/pull/90): moving client to submodule. Thanks to [@childish-sambino](https://github.com/childish-sambino)!

**Library - Chore**
- [PR #88](https://github.com/twilio/twilio-go/pull/88): split resources into separate files. Thanks to [@childish-sambino](https://github.com/childish-sambino)!
- [PR #87](https://github.com/twilio/twilio-go/pull/87): upgrade openapi-generator to version 5.1.1. Thanks to [@childish-sambino](https://github.com/childish-sambino)!
- [PR #86](https://github.com/twilio/twilio-go/pull/86): use 'int' for integer types. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!

**Library - Docs**
- [PR #89](https://github.com/twilio/twilio-go/pull/89): particulate -> participate, and minor formatting. Thanks to [@stern-shawn](https://github.com/stern-shawn)!
- [PR #85](https://github.com/twilio/twilio-go/pull/85): remove path params docs for operations without them. Thanks to [@childish-sambino](https://github.com/childish-sambino)!

**Conversations**
- Read-only Conversation Email Binding property `binding`

**Supersim**
- Add Billing Period resource for the Super Sim Pilot
- Add List endpoint to Billing Period resource for Super Sim Pilot
- Add Fetch endpoint to Billing Period resource for Super Sim Pilot

**Taskrouter**
- Update `transcribe` & `transcription_configuration` form params in Reservation update endpoint to have private visibility **(breaking change)**
- Add `transcribe` & `transcription_configuration` form params to Reservation update endpoint


[2021-06-16] Version 0.10.0
---------------------------
**Library - Fix**
- [PR #82](https://github.com/twilio/twilio-go/pull/82): array type template. Thanks to [@shamigor](https://github.com/shamigor)!

**Api**
- Update `status` enum for Messages to include 'canceled'
- Update `update_status` enum for Messages to include 'canceled'

**Trusthub**
- Corrected the sid for policy sid in customer_profile_evaluation.json and trust_product_evaluation.json **(breaking change)**


[2021-06-02] Version 0.9.0
--------------------------
**Library - Docs**
- [PR #81](https://github.com/twilio/twilio-go/pull/81): add standalone usage example. Thanks to [@eshanholtz](https://github.com/eshanholtz)!

**Library - Feature**
- [PR #80](https://github.com/twilio/twilio-go/pull/80): add RequestHandler for custom client support. Thanks to [@eshanholtz](https://github.com/eshanholtz)!

**Events**
- join Sinks and Subscriptions service

**Verify**
- Improved the documentation of `challenge` adding the maximum and minimum expected lengths of some fields.
- Improve documentation regarding `notification` by updating the documentation of the field `ttl`.


[2021-05-19] Version 0.8.0
--------------------------
**Library - Chore**
- [PR #79](https://github.com/twilio/twilio-go/pull/79): rename Ip_MessagingVx to IpMessagingVx. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)! **(breaking change)**
- [PR #77](https://github.com/twilio/twilio-go/pull/77): remove the unused client pointers. Thanks to [@childish-sambino](https://github.com/childish-sambino)!
- [PR #76](https://github.com/twilio/twilio-go/pull/76): sync the v2010 API with latest generator changes. Thanks to [@childish-sambino](https://github.com/childish-sambino)!
- [PR #75](https://github.com/twilio/twilio-go/pull/75): install pre-commit hooks on install. Thanks to [@childish-sambino](https://github.com/childish-sambino)!
- [PR #73](https://github.com/twilio/twilio-go/pull/73): move contents of 'twilio' folder to the top-level. Thanks to [@childish-sambino](https://github.com/childish-sambino)! **(breaking change)**

**Library - Docs**
- [PR #78](https://github.com/twilio/twilio-go/pull/78): update formatting for godocs. Thanks to [@thinkingserious](https://github.com/thinkingserious)!

**Library - Feature**
- [PR #74](https://github.com/twilio/twilio-go/pull/74): add param setters. Thanks to [@childish-sambino](https://github.com/childish-sambino)!
- [PR #71](https://github.com/twilio/twilio-go/pull/71): add subaccount support for v2010 apis. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)! **(breaking change)**

**Events**
- add query param to return types filtered by Schema Id
- Add query param to return sinks filtered by status
- Add query param to return sinks used/not used by a subscription

**Messaging**
- Add fetch and delete instance endpoints to us_app_to_person api **(breaking change)**
- Remove delete list endpoint from us_app_to_person api **(breaking change)**
- Update read list endpoint to return a list of us_app_to_person compliance objects **(breaking change)**
- Add `sid` field to Preregistered US App To Person response

**Supersim**
- Mark `unique_name` in Sim, Fleet, NAP resources as not PII

**Video**
- [Composer] GA maturity level


[2021-05-05] Version 0.7.0
--------------------------
**Library - Chore**
- [PR #70](https://github.com/twilio/twilio-go/pull/70): add check in BuildHost function. Thanks to [@JenniferMah](https://github.com/JenniferMah)!
- [PR #69](https://github.com/twilio/twilio-go/pull/69): update docs links. Thanks to [@thinkingserious](https://github.com/thinkingserious)!
- [PR #66](https://github.com/twilio/twilio-go/pull/66): remove redundant env var tests. Thanks to [@eshanholtz](https://github.com/eshanholtz)!

**Library - Docs**
- [PR #68](https://github.com/twilio/twilio-go/pull/68): update readme to include non v2010 examples. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!

**Api**
- Corrected the data types for feedback summary fields **(breaking change)**
- Update the conference participant create `from` and `to` param to be endpoint type for supporting client identifier and sip address

**Bulkexports**
- promoting API maturity to GA

**Events**
- Add endpoint to update description in sink
- Remove beta-feature account flag

**Messaging**
- Update `status` field in us_app_to_person api to `campaign_status` **(breaking change)**

**Verify**
- Improve documentation regarding `push` factor and include extra information about `totp` factor.


[2021-04-21] Version 0.6.0
--------------------------
**Library - Feature**
- [PR #62](https://github.com/twilio/twilio-go/pull/62): add support for region and edge values in url. Thanks to [@eshanholtz](https://github.com/eshanholtz)!

**Library - Chore**
- [PR #65](https://github.com/twilio/twilio-go/pull/65): update github action linter. Thanks to [@eshanholtz](https://github.com/eshanholtz)!
- [PR #60](https://github.com/twilio/twilio-go/pull/60): add user-agent header on all requests. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!

**Library - Fix**
- [PR #63](https://github.com/twilio/twilio-go/pull/63): parameter names in the request. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!
- [PR #59](https://github.com/twilio/twilio-go/pull/59): custom headers, cleanup docs, regenerate with the latest specs. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!

**Library - Docs**
- [PR #61](https://github.com/twilio/twilio-go/pull/61): Update readme for launch. Thanks to [@garethpaul](https://github.com/garethpaul)!

**Api**
- Revert Update the conference participant create `from` and `to` param to be endpoint type for supporting client identifier and sip address
- Update the conference participant create `from` and `to` param to be endpoint type for supporting client identifier and sip address

**Bulkexports**
- moving enum to doc root for auto generating documentation
- adding status enum and default output properties

**Events**
- Change schema_versions prop and key to versions **(breaking change)**

**Messaging**
- Add `use_inbound_webhook_on_number` field in Service API for fetch, create, update, read

**Taskrouter**
- Add `If-Match` Header based on ETag for Task Delete

**Verify**
- Add `AuthPayload` parameter to support verifying a `Challenge` upon creation. This is only supported for `totp` factors.
- Add support to resend the notifications of a `Challenge`. This is only supported for `push` factors.


[2021-04-07] Version 0.5.0
--------------------------
**Library - Docs**
- [PR #58](https://github.com/twilio/twilio-go/pull/58): update readme and documentation link. Thanks to [@JenniferMah](https://github.com/JenniferMah)!

**Library - Chore**
- [PR #56](https://github.com/twilio/twilio-go/pull/56): refactor client and regenerate with updated mustache. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!
- [PR #55](https://github.com/twilio/twilio-go/pull/55): regenerate after splitting model into separate components. Thanks to [@JenniferMah](https://github.com/JenniferMah)!

**Api**
- Added `announcement` event to conference status callback events
- Removed optional property `time_limit` in the call create request. **(breaking change)**

**Messaging**
- Add rate_limits field to Messaging Services US App To Person API
- Add usecase field in Service API for fetch, create, update, read
- Add us app to person api and us app to person usecase api as dependents in service
- Add us_app_to_person_registered field in service api for fetch, read, create, update
- Add us app to person api
- Add us app to person usecase api
- Add A2P external campaign api
- Add Usecases API

**Supersim**
- Add Create endpoint to Sims resource

**Verify**
- The `Binding` field is now returned when creating a `Factor`. This value won't be returned for other endpoints.

**Video**
- [Rooms] max_concurrent_published_tracks has got GA maturity


[2021-03-25] Version 0.4.0
--------------------------
**Api**
- Added optional parameter `CallToken` for create calls api
- Add optional property `time_limit` in the call create request.

**Bulkexports**
- adding two new fields with job api queue_position and estimated_completion_time

**Events**
- Add new endpoints to manage subscribed_events in subscriptions

**Numbers**
- Remove feature flags for RegulatoryCompliance endpoints

**Supersim**
- Add SmsCommands resource
- Add fields `SmsCommandsUrl`, `SmsCommandsMethod` and `SmsCommandsEnabled` to a Fleet resource

**Taskrouter**
- Add `If-Match` Header based on ETag for Task Update
- Add `ETag` as Response Headers to Tasks and Reservations

**Video**
- Recording rule beta flag **(breaking change)**
- [Rooms] Add RecordingRules param to Rooms


[2021-03-16] Version 0.3.0
--------------------------
**Library - Docs**
- [PR #54](https://github.com/twilio/twilio-go/pull/54): add property descriptions to docs. Thanks to [@JenniferMah](https://github.com/JenniferMah)!
- [PR #51](https://github.com/twilio/twilio-go/pull/51): fix model reference in docs. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!
- [PR #48](https://github.com/twilio/twilio-go/pull/48): adding docs for enums and getting rid of 'description' column in model docs. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!
- [PR #50](https://github.com/twilio/twilio-go/pull/50): remove optional note for nullable properties. Thanks to [@eshanholtz](https://github.com/eshanholtz)!

**Library - Feature**
- [PR #53](https://github.com/twilio/twilio-go/pull/53): regenerating with openapi-generator 5.0.1. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!

**Library - Chore**
- [PR #52](https://github.com/twilio/twilio-go/pull/52): add go linting as a pre commit hook. Thanks to [@shwetha-manvinkurke](https://github.com/shwetha-manvinkurke)!

**Events**
- Set maturity to beta

**Messaging**
- Adjust A2P brand registration status enum **(breaking change)**

**Studio**
- Remove internal safeguards for Studio V2 API usage now that it's GA

**Verify**
- Add support for creating and verifying totp factors. Support for totp factors is behind the `api.verify.totp` beta feature.


[2021-02-25] Version 0.2.0
--------------------------
**Library - Fix**
- [PR #49](https://github.com/twilio/twilio-go/pull/49): re-add enum prefixes. Thanks to [@eshanholtz](https://github.com/eshanholtz)!

**Events**
- Update description of types in the create sink resource

**Messaging**
- Add WA template header and footer
- Remove A2P campaign and use cases API **(breaking change)**
- Add number_registration_status field to read and fetch campaign responses

**Trusthub**
- Make all resources public

**Verify**
- Verify List Attempts API endpoints added.


[2021-02-17] Version 0.1.1
--------------------------


[2021-02-11] Version 0.1.0
--------------------------

