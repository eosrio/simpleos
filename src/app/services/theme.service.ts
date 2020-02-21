import {Injectable} from '@angular/core';

export const DefaultTheme = {
	/*dark theme colors*/
	'--black-sidenav': '#191919',
	'--black-background': '#272727',
	'--black-card': '#333333',
	'--dark-hover': '#1f1f1f', /*hover on dark btns, for example*/
	'--blue-color': '#0094d2',
	'--blue-darker': '#0077b7',
	'--white-color': '#ffffff',
	'--gray-lighter': '#e3e3e3', /*modal title, tab/sidenav text selected or hover, for example*/
	'--gray-lightmedium': '#b1b1b1', /*input*/
	'--gray-medium': '#a4a4a4', /*text card, text modal, for example*/
	'--gray-darker': '#696969', /*subtitles, faded information*/
	'--red-color': '#fb3c2c',

	/*concepts*/
	'--text-card-title-color': 'var(--gray-lighter)',
	'--text-free-title-color': 'var(--gray-lighter)',
	'--text-card-color': 'var(--gray-medium)',
	'--text-highlight': 'var(--white-color)',
	'--text-highlight-primary': 'var(--blue-color)',
	'--text-highlight-accent': 'var(--blue-color)',
	'--text-error': 'var(--red-color)',
	'--text-faded': 'var(--gray-darker)',

	/*buttons*/
	/*solid*/
	'--btn-primary-bg': 'var(--blue-color)',
	'--btn-primary-hover': 'var(--blue-darker)',
	'--btn-primary-color': 'var(--white-color)',
	/*outline info*/
	'--btn-info-outline': 'var(--blue-color)',
	'--btn-info-outline-hover': 'var(--blue-color)',
	'--btn-info-outline-color-hover': 'var(--white-color)',
	/*outline inverse*/
	'--btn-inverse-outline': 'var(--white-color)',
	'--btn-inverse-outline-hover': 'var(--blue-color)',
	'--btn-inverse-outline-color-hover': 'var(--white-color)',
	/*outline accent*/
	'--btn-accent-outline': 'var(--blue-color)',
	'--btn-accent-outline-hover': 'var(--blue-color)',
	'--btn-accent-outline-color-hover': 'var(--white-color)',
	/*link*/
	/*used in... refresh btn, open account on explorer, reload all proxys*/
	'--btn-primary-link-color': 'var(--blue-color)',
	'--btn-primary-link-color-hover': 'var(--blue-darker)',
	'--btn-primary-link-bg-hover': 'var(--white-color)',
	/*used in... retry connect, clear all data and logout, made with love by ->EOS Rio<-, view on github (on update)*/
	'--btn-accent-link-color': 'var(--blue-color)',
	'--btn-accent-link-color-hover': 'var(--blue-darker)',
	'--btn-accent-link-bg-hover': 'var(--white-color)',

	/*typography*/
	'--special-font': 'inherit',
	'--special-font-regular': 'inherit',
	'--special-font-bold': 'inherit',
	'--special-font-italic': 'inherit',
	'--special-font-bolditalic': 'inherit',

	/*main and body*/
	'--main-background': 'var(--black-background)',
	'--background-gd': 'linear-gradient(to right, #232526, #414345)',
	'--background-gd-webkit': '-webkit-linear-gradient(to right, #232526, #414345)',
	'--header-background': 'var(--black-background)',
	'--header-title-color': 'var(--gray-medium)',
	'--header-icon-color': 'var(--gray-lighter)',
	'--theme-icon-color': 'var(--gray-lighter)',
	'--theme-icon-color-hover': 'var(--gray-medium)',

	/*landing*/
	'--landing-background': 'url("./assets/fundosimpleos.png")',
	'--slogan-special-color': 'inherit',

	/*sidenav*/
	'--dashboard-animation-display': 'block',
	'--dashboard-img-display': 'none',
	'--sidenav-background': 'var(--black-sidenav)',
	'--sidenav-color': 'var(--gray-lightmedium)',
	'--sidenav-active-background': 'var(--black-background)',
	'--sidenav-active-color': 'var(--gray-lighter)',
	'--sidenav-active-border-color1': 'var(--black-background)',
	'--sidenav-active-border-color2': 'var(--gray-darker)',

	/*toolbar*/
	'--top-btn-background': 'var(--dark-hover)',
	'--top-btn-color': 'var(--gray-lighter)',
	/*tabs*/
	'--mat-tab-active': 'var(--black-card)',
	'--mat-tab-bar-active': 'var(--blue-color)',
	'--mat-tab-bar-height': '2px',

	/*vote tabs*/
	'--vote-tab-color': 'var(--gray-darker)',
	'--vote-tab-active': 'var(--black-card)',
	'--vote-tab-active-color': 'var(--gray-lighter)',

	/*tokens panel*/
	'--tokens-panel-background': 'var(--black-sidenav)',
	'--destaque-color-token': 'var(--blue-color)',
	'--token-title-color': 'var(--gray-lightmedium)',
	'--token-price-color': 'var(--gray-darker)',
	'--tokens-panel-hover': 'var(--dark-hover)',

	/*contacts panel*/
	'--letter-divider': 'var(--black-background)',
	'--letter-color': 'var(--gray-lighter)',
	'--contact-hover-color': 'var(--gray-lightmedium)',
	'--newcontact-btn-bg': 'transparent',
	'--newcontact-btn-color': 'var(--white-color)',
	'--newcontact-btn-bordertop': 'var(--white-color)',
	'--newcontact-btn-bg-hover': 'var(--blue-color)',
	'--newcontact-btn-color-hover': 'var(--white-color)',

	/*history table*/
	'--table-th-color': 'var(--gray-lighter)',
	'--table-th-background': 'var(--black-card)',
	'--table-tr-background': 'transparent',
	'--table-tr-color': 'var(--gray-lightmedium)',
	'--table-td-color': 'var(--gray-lightmedium)',
	'--tr-even-backgorund': 'transparent',
	'--tr-odd-backgorund': 'transparent',
	'--expand-background': 'var(--dark-hover)',
	'--tr-border-bottom-color': '1px solid #3f3f3f',

	/*cards*/
	'--info-card-background': 'var(--black-card)',
	'--info-card-bg-hover': '#3b3b3b',

	/*accordion*/
	'--accordion-header-color': 'var(--gray-lightmedium)',
	'--accordion-content-color': 'var(--gray-lightmedium)',
	'--accordion-header-color-hover': 'var(--gray-lighter)',

	/*calendar*/
	'--text-calendar': 'var(--white-color)',
	'--text-disabled-calendar': 'var(--gray-darker)',

	/*scrollbar*/
	'--scroll-track-background': 'var(--black-sidenav)',
	'--scroll-background': 'var(--black-sidenav)',
	'--scroll-thumb-background': 'var(--gray-darker)',

	/* modal / dialog / wizard */
	'--modal-background': 'var(--black-sidenav)',
	'--modal-color': 'var(--gray-medium)',
	'--modal-title-color': 'var(--gray-lighter)',
	'--modal-side-title-color': 'var(--gray-lighter)',
	'--modal-side-color': 'var(--gray-lighter)',
	'--modal-side-background': 'var(--black-background)',
	'--modal-step-background': '#535353',
	'--modal-step-line-background': '#535353',
	'--modal-step-off-color': 'var(--gray-lightmedium)',

	/*  input */
	'--input-label': 'var(--gray-lightmedium)',

	/* lent resources table */
	'--tr-resource-even-backgorund': 'var(--black-background)',
	'--tr-resource-odd-color': 'var(--gray-lighter)',
	'--tr-resource-odd-backgorund': 'transparent',
	'--tr-hover': 'var(--dark-hover)',

	/*REX page*/
	'--rex-border-color': 'var(--black-background)',

	'--text-btn-color-hover': 'var(--white-color)',
	'--text-gray2-color': '#e9e9e9',
	'--text-gray3-color': '#d6d6d6',
	'--text-white-color': 'var(--white-color)',
	'--text-blue-color': 'var(--blue-color)',
	'--made-with-love': 'var(--gray-medium)',

	'--a-link-color': 'var(--blue-color)',

	// '--update-box-background': '#1f1f1f',
	'--update-box-background': '#1f1f1f',
	'--update-box-border': 'var(--black-card)',
	'--chain-icon-bg': 'var(--gray-lighter)',
};

export const LiberlandTheme = {
	/*light theme colors*/
	'--light-bg': '#EDEDEC',
	'--light-card': '#F8F8F8',
	'--white-color': '#ffffff',
	'--blue-color': '#0094d2',
	'--blue-darker': '#0081bf',
	'--liberland-blue': '#2a566f',
	'--liberland-blue-darker': '#0f3a53',
	'--yellow-color': '#FCD215',
	'--yellow-darker': '#ebc115',
	'--black-color': '#000000', /*modal, card titles*/
	'--gray-dark': '#232323',
	'--gray-darkmedium': '#404040', /*text card, text modal, for example*/
	'--gray-medium': '#585858',
	'--gray-lightmedium': '#adadad', /*subtitles, faded information*/
	'--gray-light': '#D6D6D6',
	'--red-color': '#ff4237',

	/*concepts*/
	'--text-card-title-color': 'var(--black-color)',
	'--text-free-title-color': 'var(--gray-medium)',
	'--text-card-color': 'var(--gray-dark)',
	'--text-highlight': 'var(--black-color)',
	'--text-highlight-primary': 'var(--blue-color)',
	'--text-highlight-accent': 'var(--yellow-color)',
	'--text-error': 'var(--red-color)',
	'--text-faded': 'var(--gray-medium)',

	/*buttons*/
	/*solid*/
	'--btn-primary-bg': 'var(--liberland-blue)',
	'--btn-primary-hover': 'var(--liberland-blue-darker)',
	'--btn-primary-color': 'var(--white-color)',
	/*outline info*/
	'--btn-info-outline': 'var(--liberland-blue)',
	'--btn-info-outline-hover': 'var(--liberland-blue)',
	'--btn-info-outline-color-hover': 'var(--white-color)',
	/*outline inverse*/
	'--btn-inverse-outline': 'var(--white-color)',
	'--btn-inverse-outline-hover': 'var(--yellow-color)',
	'--btn-inverse-outline-color-hover': 'var(--liberland-blue)',
	/*outline accent*/
	'--btn-accent-outline': 'var(--yellow-color)',
	'--btn-accent-outline-hover': 'var(--yellow-color)',
	'--btn-accent-outline-color-hover': 'var(--white-color)',
	/*link*/
	/*used in... refresh btn, open account on explorer, reload all proxys*/
	'--btn-primary-link-color': 'var(--blue-color)',
	'--btn-primary-link-color-hover': 'var(--blue-darker)',
	'--btn-primary-link-bg-hover': 'var(--white-color)',
	/*used in... retry connect, clear all data and logout, made with love by ->EOS Rio<-, view on github (on update)*/
	'--btn-accent-link-color': 'var(--yellow-color)',
	'--btn-accent-link-color-hover': 'var(--yellow-darker)',
	'--btn-accent-link-bg-hover': 'var(--white-color)',

	/*typography*/
	'--special-font-regular': 'Lora',
	'--special-font-bold': 'Lora-Bold',
	'--special-font-italic': 'Lora-Italic',
	'--special-font-bolditalic': 'Lora-BoldItalic',
	'--special-font-weight': 'bold',
	'--special-font-spacing': '1.3px',

	/*main and body*/
	'--main-background': 'var(--light-bg)',
	'--background-gd': 'linear-gradient(to right, #EDEDEC, #F8F8F8)',
	'--background-gd-webkit': '-webkit-linear-gradient(to right, #EDEDEC, #F8F8F8)',
	'--header-background': 'var(--gray-light)',
	'--header-title-color': 'var(--gray-dark)',
	'--header-icon-color': 'var(--gray-dark)',
	'--theme-icon-color': 'var(--gray-medium)',
	'--theme-icon-color-hover': 'var(--gray-dark)',

	/*landing*/
	'--slogan-special-color': '#ffffff61',
	'--landing-background': 'url("./assets/cover-liberland4.png")',

	/*sidenav*/
	'--sidenav-background': 'var(--liberland-blue)',
	'--sidenav-color': '#D6D6D6',
	'--sidenav-active-background': 'var(--light-bg)',
	'--sidenav-active-color': 'var(--liberland-blue)',
	'--sidenav-active-border-color1': 'var(--light-bg)',
	'--sidenav-active-border-color2': 'var(var(--liberland-blue-darker))',

	/*toolbar*/
	'--top-btn-background': 'var(--liberland-blue-darker)',
	'--top-btn-color': 'var(--white-color)',
	'--mat-tab-active': 'var(--liberland-blue-darker)',
	'--mat-tab-bar-active': 'var(--yellow-color)',
	'--mat-tab-bar-height': '4px',

	/*vote tabs*/
	'--vote-tab-color': 'var(--gray-lightmedium)',
	'--vote-tab-active': 'var(--light-card)',
	'--vote-tab-active-color': 'var(--liberland-blue)',

	/*tokens panel*/
	'--tokens-panel-background': 'var(--liberland-blue)',
	'--destaque-color-token': 'var(--yellow-color)',
	'--token-title-color': 'var(--light-card)',
	'--token-price-color': 'var(--gray-light)',
	'--tokens-panel-hover': 'var(--liberland-blue-darker)',

	/*contacts panel*/
	'--letter-divider': 'var(--liberland-blue-darker)',
	'--letter-color': 'var(--white-color)',
	'--contact-hover-color': 'var(--liberland-blue-darker)',
	'--newcontact-btn-bg': 'var(--liberland-blue-darker)',
	'--newcontact-btn-color': 'var(--white-color)',
	'--newcontact-btn-bordertop': 'var(--white-color)',
	'--newcontact-btn-bg-hover': 'var(--yellow-color)',
	'--newcontact-btn-color-hover': 'var(--liberland-blue-darker)',

	/*history table*/
	'--table-th-color': 'var(--liberland-blue)',
	'--table-th-background': 'var(--light-card)',
	'--table-tr-background': 'var(--white-color)',
	'--table-tr-color': 'var(--gray-darkmedium)',
	'--table-td-color': 'var(--gray-darkmedium)',
	'--tr-even-backgorund': 'var(--white-color)',
	'--tr-odd-backgorund': 'var(--white-color)',
	'--expand-background': 'var(--light-card)',
	'--tr-border-bottom-color': '1px solid var(--gray-light)',
	'--tr-hover': 'var(--light-bg)',

	/*cards*/
	'--info-card-background': 'var(--light-card)',
	'--info-card-bg-hover': 'var(--gray-light)',

	/*accordion*/
	'--accordion-content-color': '#707070',
	'--accordion-header-color': '#707070',
	'--accordion-header-color-hover': 'var(--gray-darkmedium)',

	/*calendar*/
	'--text-calendar': 'var(--gray-darkmedium)',
	'--text-disabled-calendar': 'var(--gray-light)',

	/*scrollbar*/
	'--scroll-track-background': '#f1f1f1',
	'--scroll-background': '#f1f1f1',
	'--scroll-thumb-background': 'var(--gray-light)',

	/* modal / dialog / wizard */
	'--modal-background': 'var(--light-card)',
	'--modal-color': '#707070',
	'--modal-title-color': 'var(--gray-darkmedium)',
	'--modal-side-title-color': 'var(--light-card)',
	'--modal-side-color': 'var(--gray-light)',
	'--modal-side-background': 'var(--liberland-blue)',
	'--modal-step-background': 'var(--liberland-blue-darker)',
	'--modal-step-line-background': 'var(--liberland-blue-darker)',
	'--modal-step-off-color': 'var(--white-color)',

	/*  input */
	'--input-label': 'var(--gray-darkmedium)',

	/* lent resources table */
	'--tr-resource-even-backgorund': 'var(--white-color)',
	'--tr-resource-odd-color': '#202020',
	'--tr-resource-odd-backgorund': 'transparent',

	/*REX page*/
	'--rex-border-color': 'var(--light-bg)',

	'--text-white-color': '#202020',
	'--text-gray2-color': '#707070',
	'--text-gray3-color': '#a8a8a8',
	'--text-destaque-color': 'var(--yellow-color)',
	'--text-blue-color': '#2a566f',
	'--made-with-love': '#ffffff',

	'--a-link-color': '#F8F8F8',

	'--update-box-background': 'var(--light-card)',
	'--update-box-border': 'var(--liberland-blue-darker)',
	'--chain-icon-bg': '#c5c5c5',
};

export const LightTheme = {
	/*light theme colors*/
	'--white-color': '#ffffff',
	'--light-card': '#f9f9f9',
	'--blue-color': '#0094d2',
	'--blue-darker': '#0081bf',
	'--yellow-color': '#FCD215',
	'--black-color': '#000000', /*modal, card titles*/
	'--gray-dark': '#232323',
	'--gray-darkmedium': '#404040', /*text card, text modal, for example*/
	'--gray-medium': '#585858',
	'--gray-lightmedium': '#adadad', /*subtitles, faded information*/
	'--gray-light': '#dadada',
	'--red-color': '#f44336',

	/*concepts*/
	'--text-card-title-color': 'var(--black-color)',
	'--text-free-title-color': 'var(--gray-lightmedium)',
	'--text-card-color': 'var(--gray-dark)',
	'--text-highlight': 'var(--black-color)',
	'--text-highlight-primary': 'var(--blue-color)',
	'--text-highlight-accent': 'var(--yellow-color)',
	'--text-error': 'var(--red-color)',
	'--text-faded': 'var(--gray-medium)',

	/*buttons*/
	/*solid*/
	'--btn-primary-bg': 'var(--blue-color)',
	'--btn-primary-hover': 'var(--blue-darker)',
	'--btn-primary-color': 'var(--white-color)',
	/*outline info*/
	'--btn-info-outline': 'var(--blue-color)',
	'--btn-info-outline-hover': 'var(--blue-color)',
	'--btn-info-outline-color-hover': 'var(--white-color)',
	/*outline inverse*/
	'--btn-inverse-outline': 'var(--gray-dark)',
	'--btn-inverse-outline-hover': 'var(--blue-color)',
	'--btn-inverse-outline-color-hover': 'var(--white-color)',
	/*outline accent*/
	'--btn-accent-outline': 'var(--blue-color)',
	'--btn-accent-outline-hover': 'var(--blue-color)',
	'--btn-accent-outline-color-hover': 'var(--white-color)',
	/*link*/
	/*used in... refresh btn, open account on explorer, reload all proxys*/
	'--btn-primary-link-color': 'var(--blue-color)',
	'--btn-primary-link-color-hover': 'var(--blue-darker)',
	'--btn-primary-link-bg-hover': 'var(--white-color)',
	/*used in... retry connect, clear all data and logout, made with love by ->EOS Rio<-, view on github (on update)*/
	'--btn-accent-link-color': 'var(--blue-color)',
	'--btn-accent-link-color-hover': 'var(--blue-darker)',
	'--btn-accent-link-bg-hover': 'var(--white-color)',

	/*typography*/
	'--special-font': 'inherit',
	'--special-font-regular': 'inherit',
	'--special-font-bold': 'inherit',
	'--special-font-italic': 'inherit',
	'--special-font-bolditalic': 'inherit',
	'--special-font-weight': 'inherit',

	/*main and body*/
	'--main-background': 'var(--white-color)',
	'--background-gd': 'linear-gradient(to right, #EDEDEC, #F8F8F8)',
	'--background-gd-webkit': '-webkit-linear-gradient(to right, #EDEDEC, #F8F8F8)',
	'--header-background': 'var(--gray-light)',
	'--header-title-color': 'var(--gray-dark)',
	'--header-icon-color': 'var(--gray-dark)',
	'--theme-icon-color': 'var(--gray-medium)',
	'--theme-icon-color-hover': 'var(--gray-dark)',

	/*landing*/
	'--slogan-special-color': 'var(--gray-medium)',
	'--landing-background': 'url("./assets/fundosimpleoslight.png")',
	// '--landing-image-background': 'url("../../assets/fundosimpleoslight.png")',

	/*sidenav*/
	'--dashboard-animation-display': 'none',
	'--dashboard-img-display': 'block',
	'--sidenav-background': 'var(--blue-color)',
	'--sidenav-color': 'var(--white-color)',
	'--sidenav-active-background': 'var(--white-color)',
	'--sidenav-active-color': 'var(--blue-color)',
	'--sidenav-active-border-color1': 'var(--white-color)',
	'--sidenav-active-border-color2': 'var(--gray-dark)',

	/*toolbar*/
	'--top-btn-background': 'var(--blue-darker)',
	'--top-btn-color': 'var(--white-color)',
	'--mat-tab-active': 'var(--blue-darker)',
	'--mat-tab-bar-active': 'var(--yellow-color)',
	'--mat-tab-bar-height': '4px',

	/*vote tabs*/
	'--vote-tab-color': 'var(--gray-lightmedium)',
	'--vote-tab-active': 'var(--light-card)',
	'--vote-tab-active-color': 'var(--blue-color)',

	/*tokens panel*/
	'--tokens-panel-background': 'var(--light-card)',
	'--destaque-color-token': 'var(--blue-color)',
	'--token-title-color': 'var(--black-color)',
	'--token-price-color': 'var(--gray-medium)',
	'--tokens-panel-hover': 'var(--gray-light)',

	/*contacts panel*/
	'--letter-divider': 'var(--gray-lightmedium)',
	'--letter-color': 'var(--black-color)',
	'--contact-hover-color': 'var(--gray-light)',
	'--newcontact-btn-bg': 'var(--gray-light)',
	'--newcontact-btn-color': 'var(--blue-color)',
	'--newcontact-btn-bordertop': 'var(--blue-color)',
	'--newcontact-btn-bg-hover': 'var(--blue-color)',
	'--newcontact-btn-color-hover': 'var(--white-color)',

	/*history table*/
	'--table-th-color': 'var(--gray-dark)',
	'--table-th-background': 'var(--light-card)',
	'--table-tr-background': 'var(--white-color)',
	'--table-tr-color': 'var(--gray-darkmedium)',
	'--table-td-color': 'var(--gray-darkmedium)',
	'--tr-even-backgorund': 'var(--white-color)',
	'--tr-odd-backgorund': 'var(--white-color)',
	'--expand-background': 'var(--light-card)',
	'--tr-border-bottom-color': '1px solid var(--gray-light)',
	'--tr-hover': 'var(--gray-light)',

	/*cards*/
	'--info-card-background': 'var(--light-card)',
	'--info-card-bg-hover': 'var(--gray-light)',

	/*accordion*/
	'--accordion-header-color': '#707070',
	'--accordion-content-color': '#707070',
	'--accordion-header-color-hover': '#404040',

	/*calendar*/
	'--text-calendar': 'var(--gray-darkmedium)',
	'--text-disabled-calendar': 'var(--gray-light)',

	/*scrollbar*/
	'--scroll-track-background': 'var(--light-card)',
	'--scroll-background': 'var(--light-card)',
	'--scroll-thumb-background': 'var(--gray-light)',

	/* modal / dialog / wizard */
	'--modal-background': 'var(--light-card)',
	'--modal-color': '#707070',
	'--modal-title-color': '#404040',
	'--modal-side-title-color': '#F8F8F8',
	'--modal-side-color': '#d6d6d6',
	'--modal-side-background': 'var(--blue-color)',
	'--modal-step-background': 'var(--blue-darker)',
	'--modal-step-line-background': 'var(--blue-darker)',
	'--modal-step-off-color': 'var(--white-color)',

	/*  input */
	'--input-label': 'var(--gray-darkmedium)',

	/* lent resources table */
	'--tr-resource-even-backgorund': 'var(--white-color)',
	'--tr-resource-odd-color': '#202020',
	'--tr-resource-odd-backgorund': 'var(--light-card)',

	/*REX page*/
	'--rex-border-color': 'var(--gray-lightmedium)',

	'--text-white-color': '#202020',
	'--text-btn-color-hover': '#f8f8f8',
	'--text-gray2-color': '#707070',
	'--text-gray3-color': '#b1b1b1',
	'--text-blue-color': '#0094d2',
	'--made-with-love': '#404040',

	'--a-link-color': 'var(--yellow)',

	'--update-box-background': 'var(--white-color)',
	'--update-box-border': 'var(--gray-lightmedium)',
	'--chain-icon-bg': '#c5c5c5',

};

export const WaxLandingTheme = {
	/*wax theme colors*/
	'--white-color': '#ffffff',
	'--blue-card': '#002731',
	'--blue-card-darker': '#001d24',
	'--blue-color': '#0094d2',
	'--blue-darker': '#0081bf',
	'--orange-color': '#F78E1E',
	'--orange-darker': '#e8964a',
	'--black-color': '#000000', /*modal, card titles*/
	'--gray-dark': '#232323',
	'--gray-darkmedium': '#404040', /*text card, text modal, for example*/
	'--gray-medium': '#585858',
	'--gray-lightmedium': '#c0c0c0', /*subtitles, faded information*/
	'--gray-light': '#e3e3e3',
	'--red-color': '#ff5346',

	/*concepts*/
	'--text-card-title-color': 'var(--white-color)',
	// '--text-free-title-color': 'var(--gray-lightmedium)',
	'--text-card-color': 'var(--gray-light)',
	'--text-highlight': 'var(--white-color)',
	'--text-highlight-primary': 'var(--orange-color)',
	'--text-highlight-accent': 'var(--orange-color)',
	'--text-error': 'var(--red-color)',
	'--text-faded': 'var(--gray-lightmedium)',

	/*buttons*/
	/*solid*/
	'--btn-primary-bg': 'var(--orange-color)',
	'--btn-primary-hover': 'var(--orange-color)',
	'--btn-primary-color': 'var(--white-color)',
	/*outline info*/
	'--btn-info-outline': 'var(--orange-color)',
	'--btn-info-outline-hover': 'var(--orange-color)',
	'--btn-info-outline-color-hover': 'var(--white-color)',
	/*outline inverse*/
	'--btn-inverse-outline': 'var(--white-color)',
	'--btn-inverse-outline-hover': 'var(--orange-color)',
	'--btn-inverse-outline-color-hover': 'var(--white-color)',
	/*outline accent*/
	// '--btn-accent-outline': 'var(--blue-color)',
	// '--btn-accent-outline-hover': 'var(--blue-color)',
	// '--btn-accent-outline-color-hover': 'var(--white-color)',
	/*link*/
	/*used in... refresh btn, open account on explorer, reload all proxys, view on github (on update)*/
	'--btn-primary-link-color': 'var(--orange-color)',
	'--btn-primary-link-color-hover': 'var(--orange-color)',
	/*used in... retry connect, clear all data and logout, made with love by ->EOS Rio<-, */
	'--btn-accent-link-color': 'var(--orange-color)',
	'--btn-accent-link-color-hover': 'var(--orange-darker)',

	/*main and body*/
	'--header-background': 'var(--gray-darkmedium)',
	'--header-title-color': 'var(--gray-light)',
	'--header-icon-color': 'var(---gray-light)',
	'--theme-icon-color': 'var(--gray-light)',
	'--theme-icon-color-hover': 'var(--white-color)',

	/*landing*/
	'--slogan-special-color': 'var(--gray-lightmedium)',
	'--landing-background': 'url("./assets/cover-wax.jpg")',

	/*cards*/
	'--info-card-background': 'var(--blue-card)',

	/*scrollbar*/
	'--scroll-track-background': 'var(var(--blue-card))',
	'--scroll-background': '(var(--blue-card)',
	'--scroll-thumb-background': 'var(--gray-medium)',

	/* modal / dialog / wizard */
	'--modal-background': 'var(--blue-card)',
	'--modal-color': 'var(--gray-light)',
	'--modal-title-color': 'var(--white-color)',
	'--modal-side-title-color': 'var(--white-color)',
	'--modal-side-color': 'var(--gray-light)',
	// '--modal-side-color': '#d6d6d6',
	'--modal-side-background': 'var(--blue-card-darker)',
	'--modal-step-background': 'var(--orange-color)',
	'--modal-step-line-background': 'var(--orange-color)',
	'--modal-step-off-color': 'var(--white-color)',

	/*  input */
	'--input-label': 'var(--gray-light)',
	// '--input-label': '#b1b1b1',

	'--text-title-color': '#d0d0d0',

	'--chain-icon-bg': 'var(--white-color)',
	'--made-with-love': '#bfbfbf',

	'--update-box-background': 'var(--blue-card)',
};

export const TelosLandingTheme = {
	/*telos theme colors*/
	'--white-color': '#ffffff',
	'--light-card': '#f9f9f9',
	'--purple-bg': '#030039',
	'--blue-card-darker': '#001d24',
	'--blue-color': '#0094d2',
	'--blue-darker': '#0081bf',
	'--telos-purple': '#571AFF',
	'--telos-purple-darker': '#3D12B2',
	'--yellow-color':'#FFD75E',
	'--yellow-darker':'#eec65a',
	'--black-color': '#000000', /*modal, card titles*/
	'--gray-dark': '#232323',
	'--gray-darkmedium': '#404040', /*text card, text modal, for example*/
	'--gray-medium': '#585858',
	'--gray-lightmedium': '#c0c0c0', /*subtitles, faded information*/
	'--gray-light': '#e3e3e3',
	'--red-color': '#ff1301',

	/*concepts*/
	'--text-card-title-color': 'var(--black-color)',
	// '--text-free-title-color': 'var(--gray-lightmedium)',
	'--text-card-color': 'var(--gray-dark)',
	'--text-highlight': 'var(--black-color)',
	'--text-highlight-primary': 'var(--telos-purple)',
	'--text-highlight-accent': 'var(--yellow-color)',
	'--text-error': 'var(--red-color)',
	'--text-faded': 'var(--gray-medium)',

	/*buttons*/
	/*solid*/
	'--btn-primary-bg': 'var(--telos-purple)',
	'--btn-primary-hover': 'var(--telos-purple-darker)',
	'--btn-primary-color': 'var(--white-color)',
	/*outline info*/
	'--btn-info-outline': 'var(--telos-purple)',
	'--btn-info-outline-hover': 'var(--telos-purple)',
	'--btn-info-outline-color-hover': 'var(--white-color)',
	/*outline inverse*/
	'--btn-inverse-outline': 'var(--white-color)',
	'--btn-inverse-outline-hover': 'var(--telos-purple)',
	'--btn-inverse-outline-color-hover': 'var(--white-color)',
	/*outline accent*/
	// '--btn-accent-outline': 'var(--blue-color)',
	// '--btn-accent-outline-hover': 'var(--blue-color)',
	// '--btn-accent-outline-color-hover': 'var(--white-color)',
	/*link*/
	/*used in... refresh btn, open account on explorer, reload all proxys, view on github (on update)*/
	'--btn-primary-link-color': 'var(--telos-purple)',
	'--btn-primary-link-color-hover': 'var(--telos-purple-darker)',
	/*used in... retry connect, clear all data and logout, made with love by ->EOS Rio<-, */
	'--btn-accent-link-color': 'var(--yellow-color)',
	'--btn-accent-link-color-hover': 'var(--telos-purple)',

	/*main and body*/
	'--header-background': 'var(--gray-darkmedium)',
	'--header-title-color': 'var(--gray-light)',
	'--header-icon-color': 'var(---gray-light)',
	'--theme-icon-color': 'var(--gray-light)',
	'--theme-icon-color-hover': 'var(--white-color)',

	/*landing*/
	'--slogan-special-color': 'var(--gray-lightmedium)',
	'--landing-background': 'url("./assets/cover-telos.jpg")',

	/*cards*/
	'--info-card-background': 'var(--light-card)',
	'--info-card-bg-hover': 'var(--gray-light)',

	/*calendar*/
	'--text-calendar': 'var(--gray-medium)',

	/*scrollbar*/
	'--scroll-track-background': 'var(--blue-card)',
	'--scroll-background': 'var(--blue-card)',
	'--scroll-thumb-background': 'var(--gray-medium)',

	/* modal / dialog / wizard */
	'--modal-background': 'var(--light-card)',
	'--modal-color': 'var(--gray-dark)',
	'--modal-title-color': 'var(--black-color)',
	'--modal-side-title-color': 'var(--white-color)',
	'--modal-side-color': 'var(--gray-light)',
	'--modal-side-background': 'var(--purple-bg)',
	'--modal-step-background': 'var(--telos-purple)',
	'--modal-step-line-background': 'var(-telos-purple)',
	'--modal-step-off-color': 'var(--white-color)',

	/*  input */
	'--input-label': 'var(--gray-darkmedium)',

	'--text-title-color': '#d0d0d0',

	'--chain-icon-bg': 'var(--white-color)',
	'--made-with-love': '#bfbfbf',

	'--update-box-background': 'var(--light-card)',
};

@Injectable({providedIn: 'root'})
export class ThemeService {
	public currentTheme: string;

	defaultTheme() {
		this.currentTheme = 'dark';
		this.setTheme(DefaultTheme);
	}

	lightTheme() {
		this.currentTheme = 'light';
		this.setTheme(LightTheme);
	}

	liberlandTheme() {
		this.currentTheme = 'liberland';
		this.setTheme(LiberlandTheme);
	}

	waxTheme() {
		this.currentTheme = 'wax';
		this.setTheme(WaxLandingTheme);
	}

	telosTheme() {
		this.currentTheme = 'telos';
		this.setTheme(TelosLandingTheme);
	}

	private setTheme(theme: {}) {
		Object.keys(theme).forEach(k =>
			document.documentElement.style.setProperty(k, theme[k])
		);
	}
}
