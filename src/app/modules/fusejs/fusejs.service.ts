import {Injectable} from '@angular/core';

import * as Fuse from 'fuse.js';
import * as _set from 'lodash.set';
import * as _get from 'lodash.get';

import FuseOptions = Fuse.FuseOptions;


export interface AngularFusejsOptions extends FuseOptions<string> {
	supportHighlight?: boolean;
	fusejsHighlightKey?: string;
	fusejsScoreKey?: string;
	minSearchTermLength?: number;
	maximumScore?: number;
}

@Injectable()
export class FusejsService {
	private defaultOptions: AngularFusejsOptions = {
		supportHighlight: true,
		shouldSort: false,
		threshold: 0.6,
		location: 0,
		distance: 100,
		maxPatternLength: 32,
		minMatchCharLength: 2,
		includeScore: true,
		minSearchTermLength: 3,
		fusejsHighlightKey: 'fuseJsHighlighted',
		fusejsScoreKey: 'fuseJsScore',
	};

	searchList(list: Array<any>, searchTerms: string, options: AngularFusejsOptions = {}) {
		const fuseOptions: AngularFusejsOptions = Object.assign({}, this.defaultOptions, options);
		let result = [];
		if (searchTerms && searchTerms.length >= fuseOptions.minSearchTermLength) {
			if (fuseOptions.supportHighlight) {
				fuseOptions.includeMatches = true;
			}
			const fuse = new Fuse(list, fuseOptions);
			result = fuse.search(searchTerms);
			if (fuseOptions.supportHighlight) {
				result = this.handleHighlight(result, fuseOptions);
			}
		} else {
			result = this.deepClone(list);
			if (fuseOptions.supportHighlight) {
				result.forEach((element) => {
					element[fuseOptions.fusejsHighlightKey] = this.deepClone(element);
				});
			}
		}

		return result;
	}

	private deepClone(o) {
		let _out, v;
		_out = Array.isArray(o) ? [] : {};
		for (const _key in o) {
			if (o.hasOwnProperty(_key)) {
				v = o[_key];
				_out[_key] = (typeof v === 'object') ? this.deepClone(v) : v;
			}
		}
		return _out;
	}

	private handleHighlight(result, options: AngularFusejsOptions) {
		if (options.maximumScore && options.includeScore) {
			result = result.filter((matchObject) => {
				return matchObject.score <= options.maximumScore;
			});
		}
		return result.map((matchObject) => {
			const item = this.deepClone(matchObject.item);
			item[options.fusejsHighlightKey] = this.deepClone(item);
			item[options.fusejsScoreKey] = matchObject.score;
			for (const match of matchObject.matches) {
				const indices: number[][] = match.indices;
				let highlightOffset = 0;
				let key: string = match.key;
				if (_get(item[options.fusejsHighlightKey], key).constructor === Array) {
					key += `[${match.arrayIndex}]`;
				}
				for (const indice of indices) {
					const initialValue: string = _get(item[options.fusejsHighlightKey], key) as string;
					const startOffset = indice[0] + highlightOffset;
					const endOffset = indice[1] + highlightOffset + 1;
					const highlightedTerm = initialValue.substring(startOffset, endOffset);
					const newValue = initialValue.substring(0, startOffset) + '<em>' + highlightedTerm + '</em>' + initialValue.substring(endOffset);
					highlightOffset += '<em></em>'.length;
					_set(item[options.fusejsHighlightKey], key, newValue);
				}
			}
			return item;
		});
	}
}
