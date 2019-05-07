import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {BehaviorSubject} from 'rxjs';
import {AccountsService} from './accounts.service';

export interface ChartPoint {
	time: Date;
	value: number;
}

@Injectable({
	providedIn: 'root'
})
export class RexChartsService {

	rexPriceChart: BehaviorSubject<ChartPoint[]>;
	borrowingCostChart: BehaviorSubject<ChartPoint[]>;

	constructor(
		private http: HttpClient,
		private aService: AccountsService
	) {
		this.borrowingCostChart = new BehaviorSubject<ChartPoint[]>(null);
		this.rexPriceChart = new BehaviorSubject<ChartPoint[]>(null);
	}

	async getChart(type: string, range: string, interval: string) {
		let chain = '';
		switch (this.aService.activeChain['name']) {
			case 'EOS MAINNET': {
				chain = 'mainnet';
				break;
			}
			case 'BOS MAINNET': {
				chain = 'bos_mainnet';
				break;
			}
			case 'EOS JUNGLE TESTNET': {
				chain = 'jungle';
				break;
			}
			case 'BOS TESTNET': {
				chain = 'bos_testnet';
				break;
			}
			case 'EOS KYLIN TESTNET': {
				chain = 'kylin';
				break;
			}
			default: {
				return null;
			}
		}
		const response = await this.http.get('https://br.eosrio.io/rex/chart?field=' + type + '&range=' + range + '&interval=' + interval + '&chain=' + chain, {
			responseType: 'text'
		}).toPromise();
		const arr = response.split('\n');
		arr.shift();
		const result = [];
		arr.forEach((line) => {
			const fields = line.split(',');
			if (fields.length > 1) {
				if (fields[4].split('.').length > 1) {
					fields[4] = fields[4].split('.')[0] + '.000Z';
				} else {
					fields[4] = fields[4].replace('Z', '.000Z');
				}
				result.push({
					time: fields[4],
					value: parseFloat(fields[3])
				});
			}
		});
		return result;
	}

	async loadCharts(_range: string, _interval: string) {
		this.rexPriceChart.next(await this.getChart('rex_price', _range, _interval));
		this.borrowingCostChart.next(await this.getChart('borrowing_cost', _range, _interval));
	}
}
