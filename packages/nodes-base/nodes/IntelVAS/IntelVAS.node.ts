import {
	IExecuteFunctions
} from 'n8n-core';

import {
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

import {
	OptionsWithUri,
} from 'request';

export class IntelVAS implements INodeType {

	/*
	* Creating the parameters UI for IntelVAS node. n8n reads
	* the following 'description' JSON data. Creates properties
	* and credentials fields based on this. Also defines name of the Node
	* and several other metadata for the node, apart from properties and
	* credentials.
	*/
	description : INodeTypeDescription = {
			displayName: 'Intel RI - VAS',
			name: 'intelvas',
			icon: 'file:vasNodeLogo.svg',
			group: ['transform'],
			version: 1,
			description: 'Intel Video Analytics Serving',
			defaults: {
				name: 'IntelVAS',
				color: '#007DC3',
			},
			inputs: ['main'],
			outputs: ['main'],

			credentials: [
				{
					name: 'intelVASApi',
					required: true,
				}
			],

			properties: [
				{
					displayName : 'VAS Pipeline',
					name : 'pipeline',
					type : 'options',

					options: [
						{
							name : 'Detect Person-Vehicle-Bike',
							value : 'person_vehicle_bike',
							description : 'Based on person-vehicle-bike-detection-crossroad-0078',
						},
						{
							name : 'Classify Vehicle Attributes',
							value : 'object_classification',
							description : 'Based on person-vehicle-bike-detection-crossroad-0078 and vehicle-attributes-recognition-barrier-0039',
						},
						{
							name : 'Recognise Actions',
							value : 'action_recognition',
							description : 'General action recognition based on action-recognition-0001',
						},
						{
							name : 'Track Line Crossing',
							value : 'object_line_crossing',
							description : 'Object Tracking pipeline with Line Crossing Tracking module',
						},
						{
							name : 'Detect Audio',
							value : 'audio_detection',
							description : 'Environmental sound detection based on Aclnet',
						},
					],

					default: '',
					required: true,
					description: 'Select a pipeline to run.',
				},

				{
					displayName: 'Operation',
					name: 'operation',
					type: 'options',

					displayOptions: {
						show: {
							pipeline: [
								'audio_detection', 'person_vehicle_bike', 'object_line_crossing','object_classification',
								'action_recognition',
							]
						}
					},

					options: [
						{
							name: 'Start',
							value: 'start',
							description: 'Start a pipeline.',
						},
						{
							name: 'Stop',
							value: 'stop',
							description: 'Stop a running pipeline.',
						},
						{
							name: 'Status',
							value: 'status',
							description: 'Get the status of a pipeline.',
						}
					],

					default: '',
					description: 'The operation to be performed on selected pipeline.',
				},

				{
					displayName: 'Video URI',
					name: 'uri',
					type: 'string',
					required: true,

					displayOptions: {
						show: {
							operation: [
								'start'
							]
						}
					},

					default: '',
					description: 'Enter URI for video file. Could be from local file system or a remote server.',
				},

				{
					displayName: 'Instance ID',
					name: 'instance_id',
					type: 'string',
					required: true,

					displayOptions: {
						show: {
							operation: [
								'stop', 'status'
							]
						}
					},

					default: '',
					description: 'Provide the instanceID of a running pipline.',
				},

				{
					displayName: 'Additional Parameters',
					name: 'parameters',
					type: 'collection',
					placeholder: 'Add parameter',
					default: {},

					displayOptions: {
						show: {
							operation: ['start'],
						}
					},

					options: [
						{
							displayName: 'Detection Device',
							name: 'detection_device',
							type: 'string',
							default: '',
							description : "Hardware accelerator to be used for detection.",
						},
						{
							displayName: 'Scaling Method',
							name: 'scaling_method',
							type: 'options',

							options : [
								{
									name : 'Bilinear',
									value : 'bilinear',
									description : "Bilinear technique for image scaling."
								},
								{
									name : 'Nearest-Neighbour',
									value : 'nearest-neighbour',
									description : "Nearest-Neighbour technique for image scaling.",
								}
							],

							default: 'bilinear',
							description : "Choose a technique for image scaling.",
						},
						{
							displayName: 'Inference Interval',
							name: 'inference_interval',
							type: 'string',
							default: '',
							description : 'Choose a time interval between inference updates. ',
						},
						{
							displayName: 'Threshold',
							name: 'threshold',
							type: 'string',
							default: '',
							description : 'Choose a confidence level for inferences. Between 0-1.'
						}
					],
				}
			],
	};

	/*
	* Method to be executed each time an IntelVAS node is executed.
	*/
	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {

		/**
		 * We have different hostname for MQTT broker on dev machine
		 * and VM instance. Hence, we use environment vars to get
		 * appropriate hostname for both machines. We set N8N_HOST var
		 * on both machines. If var is not set we consider MQTT to be
		 * running on localhost.
		 */
		const MQTT_HOST = ("MQTT_HOST" in process.env) ? process.env.MQTT_HOST : "localhost";


		/**
		 * Getting the input from previous n8n nodes, in case current node has
		 * to be executed for each item in a list being forwarded by previous
		 * node.
		 */
		const items = this.getInputData();

		// getting the values for some pf the properties from the node UI.
		const pipeline = this.getNodeParameter('pipeline', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// getting credentials provided by user as an object
		const credentials = await this.getCredentials ('intelVASApi') as IDataObject;

		let api_response;	// stores response data from VAS API
		let node_response = []; // stores the n8n node output, displayed to user after execution finishes.
		let body_payload : IDataObject; // parameters to be sent as HTTP request to VAS API
		var request_to_rest_api;

		/*
		* A function to build the endpoint string, based on pipeline name selected
		* from the 'VAS Pipeline' drop-down options.
		*/
		let getEndpoint = (pipeline_name: string) => {
			switch (pipeline_name) {
				case 'person_vehicle_bike':
					return 'object_detection/person_vehicle_bike' as string;
					break;

				case 'audio_detection':
					return 'audio_detection/environment' as string;
					break;

				case 'object_line_crossing':
					return 'object_tracking/object_line_crossing' as string;
					break;

				case 'object_classification':
					return 'object_classification/vehicle_attributes' as string;
					break;

				case 'action_recognition':
					return 'action_recognition/general' as string;
					break;

				default:
					return '';

			}
		};

		/*
		* Building the final api endpoint uri by concatenating base url with
		* the string returned by getEndpoint() function.
		*/
		const api_base_url = "http://" + credentials.vas_host + ":" + credentials.vas_port + "/pipelines/";
		const api_endpoint = api_base_url + getEndpoint (pipeline);

		/**
		 * We need to start execution of VAS node for each input item we are
		 * receiving from last node. This loop will take care of that.
		 */
		for (let i = 0; i < items.length; i++) {
			/*
			* Build the HTTP request ro be sent to the API,
			* based on option selected in the 'Operations' field.
			* If the operation is to start the pipeline:
			*/

			if (operation === "start") {

				// get the video file path provided in 'Video URI' field
				const video_uri = this.getNodeParameter('uri', i) as string;

				/*
				* Build mqtt host string based on values provided in credentials
				* and hard-coded host name.
				*/
				const mqtt_host_port = MQTT_HOST + ":" + credentials.mqtt_port;

				// get additional parameters, if any.
				const additional_field = this.getNodeParameter('parameters', i) as IDataObject;

				/*
				* Prepare the payload to be send as body parameter to start the pipeline.
				* Format of paramters is based on REST API provided by VAS.
				*/
				body_payload = {
					source : {
						uri : video_uri,
						type : "uri",
					},
					destination : {
						metadata : {
							type : "mqtt",
							host : mqtt_host_port,
							topic : credentials.mqtt_topic,
						},
					},

					parameters : {}, // keep it empty. assign properties based on additional parameters.
				}

				/*
				* If non-default values for 'detection device' or 'scaling_method',
				* or any other additional parameter is provided,
				* add it to 'parameters' properties in body_payload.
				*/
				if (additional_field.detection_device !== undefined) {
					const detection_device : IDataObject = {
						"device" :  additional_field.detection_device,
					};

					Object.assign (body_payload.parameters, detection_device);
				}

				if (additional_field.scaling_method !== undefined) {
					const scaling_method : IDataObject = {
						"scale_method" : additional_field.scaling_method,
					};

					Object.assign (body_payload.parameters, scaling_method);
				}

				if (additional_field.inference_interval !== undefined) {
					const inference_interval : IDataObject = {
						"inference-interval": parseInt (additional_field.inference_interval as string),
					};

					Object.assign (body_payload.parameters, inference_interval);
				}

				if (additional_field.threshold !== undefined) {
					const threshold : IDataObject = {
						"threshold" : Number (additional_field.threshold as string),
					};

					Object.assign (body_payload.parameters, threshold);
				}

				/**
				 * Prepare the request to be sent as 'POST' to VAS API
				 * to start the pipeline.
				 */
				request_to_rest_api = {
					method : 'POST',
					body : body_payload,
					uri : api_endpoint,
					json : true,
				} as OptionsWithUri;

				console.log(body_payload);
			}

			/**
			 * If the operation is to stop the pipleline.
			 */
			else if (operation === 'stop') {

				// get the instance ID provided by the user in the node UI
				const instance_id = this.getNodeParameter('instance_id', i) as string;

				// prepare the endpoint to send stop request to.
				const endpoint_to_stop_instance = api_endpoint + "/" + instance_id;

				// prepare the request to be sent to VAS API to stop pipeline
				request_to_rest_api = {
					method : 'DELETE',
					uri : endpoint_to_stop_instance,
				} as OptionsWithUri;
			}

			// if the operation selected is to get the status of pipeline.
			else if (operation === 'status') {

				// get the instanceID provided by user in the UI
				const instance_id = this.getNodeParameter('instance_id', i) as string;

				// prepare the endpoint to send statusrequest to.
				const endpoint_to_get_status = api_endpoint + "/" + instance_id + "/status";

				// prepare the request to be sent to VAS API to get status of pipeline
				request_to_rest_api = {
					method : 'GET',
					uri : endpoint_to_get_status,
				} as OptionsWithUri;
			}

			// send the request and receive response by VAS API in 'api_response'
			api_response = await this.helpers.request(request_to_rest_api);


			/**
			 * If operation was to start pipeline, then, api_response is a mere integer,
			 * which is the instance_id. Format the response and add some human-readable info.
			 * */
			if (operation === 'start') {
				const json_response = {
					id : api_response,
					instance_status : 'CREATED',
				}

				api_response = json_response;
			}

			/**
			 * If operation was to stop pipeline, then, api_response merely
			 * returns the current status before stopping the pipeline. That could be
			 * confusing. So, we add 'stop_request' to the api_response, to show status
			 * of stop request. However, if api_response shows that pipeline has
			 * already completed or is already stopped due to an error,
			 * we don't add stop_request.
			 */
			if (operation === 'stop') {
				if (api_response.state !== 'COMPLETED' && api_response.state !== 'ERROR') {
					Object.assign(api_response, {stop_request: 'SUCCESS'});
				}
			}

			/**
			 * Add the formatted response to the 'node_response' array which will be
			 * available as the IntelVAS node output in n8n UI.
			 */
			node_response.push(api_response);

		}

		return [this.helpers.returnJsonArray(node_response)];
	}
}
