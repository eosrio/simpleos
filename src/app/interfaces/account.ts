export interface EOSAccount {
	name: string;
	details: any;
	unstaked: number;
	unstaking: number;
	full_balance: number;
	staked: number;
	unstakeTime: string;
	activitypastday:boolean;
	actions: any[];
	type: string;
	storedKey: string;
	storedPerm: string;
}
