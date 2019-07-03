import {ProposalJsonData} from './proposal-json-data';

export interface Proposal {
	id: string;
	expireInfo: string;
	proposal: {
		created_at: string;
		expires_at: string;
		proposal_name: string;
		proposer: string;
		title: string;
		proposal_json: string;
		json_data: ProposalJsonData[];
	};
	stats: {
		votes: any;
		accounts: any;
		proxies: any;
		staked: any;
		vote_participation: boolean;
		more_yes: boolean;
		sustained_days: number;
		block_num: number;
		currency_supply: number;
	};
}
