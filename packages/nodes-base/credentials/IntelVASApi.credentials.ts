import {
	ICredentialType,
	NodePropertyTypes,
} from 'n8n-workflow';

export class IntelVASApi implements ICredentialType {
	name = 'intelVASApi';
	displayName = 'Intel VAS API';
	documentationUrl = 'https://github.com/intel/video-analytics-serving';

	properties = [
		{
			displayName: 'Host',
			name: 'vas_host',
			type: 'string' as NodePropertyTypes,
			default: '',
			required: true,
			description : "Host address where VAS is running.",
		},
		{
			displayName: 'Port',
			name: 'vas_port',
			type: 'number' as NodePropertyTypes,
			default: undefined,
			typeOptions: {
				maxValue: 65535,
			},
			required: true,
			description : "Port address on which VAS is listening.",
		},
		{
			displayName: 'MQTT Port',
			name: 'mqtt_port',
			type: 'number' as NodePropertyTypes,
			default: undefined,
			typeOptions: {
				maxValue: 65535,
			},
			required: true,
			description : "Port address on which MQTT broker is listening.",
		},
		{
			displayName: 'MQTT Topic',
			name: 'mqtt_topic',
			type: 'string' as NodePropertyTypes,
			default: 'vaserving',
			description : "Topic name on which VAS inferences will be published.",
		}
	];

}
