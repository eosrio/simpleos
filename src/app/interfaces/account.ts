export interface EOSAccount {
	lastActionCheck: number;
	name: string;
	details: any;
	unstaked: number;
	unstaking: number;
	full_balance: number;
	staked: number;
	unstakeTime: string;
	pastDayActivity: boolean;
	actions: any[];
	type: string;
	storedKey: string;
	storedPerm: string;
}
