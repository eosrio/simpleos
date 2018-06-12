import { Injectable } from '@angular/core';
import {FormControl} from '@angular/forms';

@Injectable()
export class ValidationService {

  constructor() { }

    static passValidator(control: FormControl): { [s: string]: boolean } {
        function validatePass(pass: string) {
            const regex = /^.{10,}$/;
            return regex.test(pass.toLowerCase());
        }
        if (validatePass(control.value) === true) {
            return null;
        } else {
            return {'invalidPass': true};
        }
    }
}
