
import {s1} from './_secret';
export const environment = {
	production: true,
	VERSION: require('../../package.json').version,
	COMPILERVERSION: require('../../package.json').compilerVersion,
	JWT_TOKEN: s1
};
