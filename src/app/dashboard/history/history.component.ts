import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.css']
})
export class HistoryComponent implements OnInit {
  history: any[];

  constructor() {
      this.history = [
          { type: 'sent', amount: '5', user: '', date: '1 minute ago', id: '1'},
          { type: 'received', amount: '5', user: '', date: '1 minute ago', id: '2'},
          { type: 'unstaked', amount: '5', user: '', date: '1 minute ago', id: '3'},
          { type: 'staked', amount: '5', user: '', date: '1 minute ago', id: '4'},
          { type: 'sent', amount: '5', user: '', date: '1 minute ago', id: '5'},
          { type: 'received', amount: '5', user: '', date: '1 minute ago', id: '6'},
          { type: 'received', amount: '5', user: '', date: '1 minute ago', id: '7'},
          { type: 'received', amount: '5', user: '', date: '1 minute ago', id: '8'},
          { type: 'received', amount: '5', user: '', date: '1 minute ago', id: '9'},
          { type: 'sent', amount: '5', user: '', date: '1 minute ago', id: '10'},
          { type: 'sent', amount: '5', user: '', date: '1 minute ago', id: '11'}
      ];
  }

  ngOnInit() {

  }

}
