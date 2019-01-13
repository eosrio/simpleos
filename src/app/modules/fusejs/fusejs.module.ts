import {NgModule} from '@angular/core';
import {FusejsService} from './fusejs.service';
import {FusejsPipe} from './fusejs.pipe';

@NgModule({
	providers: [
		FusejsService
	],
	declarations: [
		FusejsPipe,
	],
	exports: [
		FusejsPipe,
	]
})
export class FuseJsModule {
}
