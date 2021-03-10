import { Component, OnInit } from '@angular/core';
import {AccountsService} from "../../services/accounts.service";

@Component({
  selector: 'app-account-home',
  templateUrl: './account-home.component.html',
  styleUrls: ['./account-home.component.css']
})
export class AccountHomeComponent implements OnInit {

  constructor(public aService: AccountsService) { }

  ngOnInit(): void {
  }

}
