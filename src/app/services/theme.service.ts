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

	/*tokens panel*/
	'--tokens-panel-background': 'var(--black-sidenav)',
	'--destaque-color-token': 'var(--blue-color)',
	'--token-title-color': 'var(--gray-lightmedium)',
	'--token-price-color': 'var(--gray-darker)',
	'--tokens-panel-hover': 'var(--dark-hover)',

	/*contacts panel*/
	'--letter-divider': 'var(--black-background)',
	'--contact-hover-color': 'var(--gray-lightmedium)',
	'--newcontact-btn-bg': 'transparent',
	'--newcontact-btn-color': 'var(--white-color)',
	'--newcontact-btn-bordertop': 'var(--white-color)',
	'--newcontact-btn-bg-hover': 'var(--blue-color)',

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

	/* lent resources table */
	'--tr-resource-even-backgorund': 'var(--black-background)',
	'--tr-resource-odd-color': 'var(--gray-lighter)',
	'--tr-resource-odd-backgorund': 'transparent',
	'--tr-hover': 'var(--dark-hover)',

	/*REX page*/
	'--rex-balance-title-color': 'var(--gray-lightmedium)',
	'--rex-balance-info-color': 'var(--white-color)',
	'--rex-btn-color': 'var(--blue-color)',
	'--rex-border-color': 'var(--blue-color)',

	'--text-btn-color-hover': 'var(--white-color)',
	'--text-gray-color': 'var(--gray-lightmedium)',
	'--text-gray2-color': '#e9e9e9',
	'--text-gray3-color': '#d6d6d6',
	'--text-white-color': 'var(--white-color)',
	'--text-blue-color': 'var(--blue-color)',
	'--made-with-love': 'var(--gray-medium)',

	'--a-link-color': 'var(--blue-color)',

	'--btn-border-color': 'var(--blue-color)',
	'--btn-color': 'var(--blue-color)',
	'--btn-success-color': 'var(--white-color)',
	'--btn-color-hover': 'var(--white-color)',
	'--btn-background-hover': 'var(--blue-color)',
	'--btn-rev-color-hover': 'var(--blue-color)',

	'--btn-primary-bg': 'var(--blue-color)',
	'--btn-primary-hover': 'var(--blue-darker)',

	'--btn-inverse-color': 'var(--white-color)',
	'--btn-inverse-background-hover': 'var(--blue-color)',
	'--btn-inverse-color-hover': 'var(--white-color)',

	'--btn-inverse2-color': 'var(--white-color)',
	'--btn-inverse2-background-hover': 'var(--white-color)',
	'--btn-inverse2-color-hover': 'var(--blue-color)',

	'--btn-link2-color': 'var(--blue-color)',
	'--btn-link2-background-hover': 'var(--white-color)',
	'--btn-link2-color-hover': 'var(--blue-darker)',

	'--btn-link-color': 'var(--blue-color)',
	'--btn-link-background-hover': 'var(--white-color)',
	'--btn-link-color-hover': 'var(--blue-darker)',

	'--update-box-background': '#1f1f1f',
	'--chain-icon-bg': 'var(--gray-lighter)',
};

export const LiberlandTheme = {
	'--main-background': '#EDEDEC',
	'--background-gd': 'linear-gradient(to right, #EDEDEC, #F8F8F8)',
	'--background-gd-webkit': '-webkit-linear-gradient(to right, #EDEDEC, #F8F8F8)',
	'--header-background': '#D1D1D1',
	'--header-title-color': '#292929',
	'--header-icon-color': '#20202095',
	'--theme-icon-color': '#20202095',
	'--theme-icon-color-hover': '#292929',
	'--special-font-regular': 'Lora',
	'--special-font-bold': 'Lora-Bold',
	'--special-font-italic': 'Lora-Italic',
	'--special-font-bolditalic': 'Lora-BoldItalic',
	'--special-font-weight': 'bold',
	'--special-font-spacing': '1.3px',
	'--slogan-special-color': '#ffffff61',

	'--landing-background': 'url("./assets/cover-liberland4.png")',

	'--sidenav-background': '#2a566f',
	'--sidenav-color': '#D6D6D6',
	'--sidenav-active-background': '#EDEDEC',
	'--sidenav-active-color': '#2a566f',
	'--sidenav-active-border-color1': '#EDEDEC',

	'--top-btn-backgorund': '#0f3a53',
	'--top-btn-color': '#f8f8f8',

	'--mat-tab-active': '#0f3a53',
	'--mat-tab-bar-active': '#FCD215',
	'--mat-tab-bar-height': '4px',

	'--tokens-panel-background': '#2a566f',
	'--destaque-color-token': '#FCD215',
	'--token-title-color': '#f8f8f8',
	'--token-price-color': '#D6D6D6',
	'--tokens-panel-hover': 'var(--gray-lighter)',

	'--letter-divider': '#FCD215',
	'--contact-hover-color': '#292929',

	'--accordion-content-color': '#707070',
	'--accordion-header-color': '#707070',
	'--accordion-header-color-hover': '#404040',

	'--info-card-background': '#F8F8F8',
	'--card-hover-backgorund': '#ececec',
	'--expand-background': '#FAFAFA',

	'--text-calendar': '#404040',
	'--text-disabled-calendar': '#d6d6d6',

	'--scroll-track-background': '#f1f1f1',
	'--scroll-background': '#f1f1f1',
	'--scroll-thumb-background': '#D6D6D6',

	'--table-th-color': '#2a566f',
	'--table-th-background': '#f8f8f8',
	'--table-tr-background': '#ffffff',
	'--table-tr-color': '#404040',
	'--table-td-color': '#404040',

	'--verify-card-text-color': '#404040',
	'--verify-card-backgound-color': '#f8f8f8',

	'--text-title-color': '#404040',
	'--text-white-color': '#202020',
	'--text-btn-color-hover': '#f8f8f8',
	'--text-gray-color': '#404040',
	'--text-gray2-color': '#707070',
	'--text-gray3-color': '#a8a8a8',
	'--text-destaque-color': '#FCD215',
	'--text-blue-color': '#2a566f',
	'--text-error': '#ff4237',
	'--made-with-love': '#ffffff',

	'--a-link-color': '#F8F8F8',

	'--modal-background': '#F8F8F8',
	'--modal-color': '#707070',
	'--modal-title-color': '#404040',
	'--modal-side-title-color': '#F8F8F8',
	'--modal-side-color': '#d6d6d6',
	'--modal-side-background': '#2a566f',
	'--modal-step-background': '#0f3a53',
	'--modal-step-line-background': '#0f3a53',
	'--modal-step-off-color': '#ffffff',

	'--tr-even-backgorund': '#ffffff',
	'--tr-odd-backgorund': '#ffffff',
	'--tr-border-bottom-color': '1px solid #cccccc',

	'--tr-resource-even-backgorund': '#2a566f',
	'--tr-resource-odd-color': '#202020',
	'--tr-resource-odd-backgorund': 'transparent',
	'--tr-hover': '#d2d2d2',

	'--rex-balance-title-color': '#cccccc',
	'--rex-balance-info-color': '#f8f8f8',
	'--rex-btn-color': '#ffffff',
	'--rex-border-color': '#ffffff',

	'--btn-border-color': '#2a566f',
	'--btn-color': '#2a566f',
	'--btn-success-color': 'white',
	'--btn-color-hover': '#ffffff',
	'--btn-background-hover': '#2a566f',
	'--btn-rev-color-hover': '#2a566f',

	'--btn-primary-bg': '#2a566f',
	'--btn-primary-hover': '#0f3a53',

	'--btn-inverse-color': '#ffffff',
	'--btn-inverse-background-hover': '#ffffff',
	'--btn-inverse-color-hover': '#084577',

	'--btn-inverse2-color': '#202020',
	'--btn-inverse2-background-hover': '#ffffff',
	'--btn-inverse2-color-hover': '#084577',

	// '--btn-link2-color': '#FCD215',
	'--btn-link2-color': '#efc718',
	'--btn-link2-background-hover': '#ffffff',
	'--btn-link2-color-hover': '#c39d13',

	'--btn-link3-color': '#2a566f',
	'--btn-link3-background': '#ffffff',
	'--btn-link3-background-hover': '#2a566f',
	'--btn-link3-color-hover': '#FCD215',
	'--btn-link3-hover-border-color': '#2a566f',

	'--btn-link-color': '#0094d2',
	// '--btn-link-color': '#1577C6',
	'--btn-link-background-hover': '#ffffff',
	'--btn-link-color-hover': '#084577',

	'--update-box-background': '#0d3352',
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

	/*tokens panel*/
	'--tokens-panel-background': 'var(--light-card)',
	'--destaque-color-token': 'var(--blue-color)',
	'--token-title-color': 'var(--black-color)',
	'--token-price-color': 'var(--gray-medium)',
	'--tokens-panel-hover': 'var(--gray-light)',

	/*contacts panel*/
	'--letter-divider': 'var(--gray-lightmedium)',
	'--contact-hover-color': 'var(--gray-light)',
	'--newcontact-btn-bg': 'var(--gray-light)',
	'--newcontact-btn-color': 'var(--black-color)',
	'--newcontact-btn-bordertop': 'var(--black-color)',
	'--newcontact-btn-bg-hover': 'var(--blue-color)',

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

	/* lent resources table */
	'--tr-resource-even-backgorund': 'var(--white-color)',
	'--tr-resource-odd-color': '#202020',
	'--tr-resource-odd-backgorund': 'var(--light-card)',

	/*REX page*/
	'--rex-balance-title-color': '#e9e9e9',
	'--rex-balance-info-color': '#f8f8f8',
	'--rex-btn-color': '#ffffff',
	'--rex-border-color': '#ffffff',

	// '--text-title-color': '#404040',
	'--text-white-color': '#202020',
	'--text-btn-color-hover': '#f8f8f8',
	'--text-gray-color': '#404040',
	'--text-gray2-color': '#707070',
	'--text-gray3-color': '#b1b1b1',
	'--text-blue-color': '#0094d2',
	'--made-with-love': '#404040',

	'--a-link-color': 'var(--yellow)',

	'--btn-border-color': '#0094d2',
	'--btn-color': '#0094d2',
	'--btn-success-color': '#303030',
	'--btn-color-hover': '#ffffff',
	'--btn-background-hover': '#0094d2',
	'--btn-rev-color-hover': '#0094d2',

	'--btn-primary-bg': '#0079b8',
	'--btn-primary-hover': '#004d8a',

	'--btn-inverse-color': '#0094d2',
	'--btn-inverse-background-hover': '#0094d2',
	'--btn-inverse-color-hover': '#ffffff',

	'--btn-inverse2-color': '#404040',
	'--btn-inverse2-background-hover': '#ffffff',
	'--btn-inverse2-color-hover': '#0094d2',

	'--btn-link2-color': '#0079b8',
	'--btn-link2-background-hover': '#ffffff',
	'--btn-link2-color-hover': '#0066a6',

	'--btn-link-color': '#0094d2',
	'--btn-link-background-hover': '#ffffff',
	'--btn-link-color-hover': '#0077b7',

	'--update-box-background': '#a4a4a4',
	'--chain-icon-bg': '#c5c5c5',

};

export const WaxLandingTheme = {
	'--landing-background': 'url("./assets/cover-wax.jpg")',
	'--info-card-background': '#002731',
	'--btn-inverse-background-hover': '#F78E1E',
	'--text-title-color': '#d0d0d0',
	'--text-blue-color': '#F78E1E',
	'--update-box-background': '#002731',
	'--btn-link-color': '#F78E1E',
	'--btn-link-color-hover': '#e8964a',
	'--btn-link2-color': '#F78E1E',
	'--btn-rev-color-hover': '#F78E1E',
	'--modal-background': '#002731',
	'--btn-border-color': '#F78E1E',
	'--btn-color': '#F78E1E',
	'--btn-background-hover': '#F78E1E',
	'--modal-side-background': '#001d24',
	'--modal-step-off-color': '#ffffff',
	'--btn-primary-bg': '#c56907',
	'--btn-primary-hover': '#8f4c05',
	'--chain-icon-bg': 'white',
	'--text-error': '#ec4d40',
	'--made-with-love': '#bfbfbf',
	'--modal-title-color': '#ffffff',
	'--text-gray-color': '#b1b1b1',
};

@Injectable({providedIn: 'root'})
export class ThemeService {
	public currentTheme: string;

	defaultTheme() {
		this.currentTheme = 'dark';
		this.setTheme(DefaultTheme);
	}

	liberlandTheme() {
		this.currentTheme = 'liberland';
		this.setTheme(LiberlandTheme);
	}

	waxTheme() {
		this.currentTheme = 'wax';
		this.setTheme(WaxLandingTheme);
	}

	lightTheme() {
		this.currentTheme = 'light';
		this.setTheme(LightTheme);
	}

	private setTheme(theme: {}) {
		Object.keys(theme).forEach(k =>
			document.documentElement.style.setProperty(k, theme[k])
		);
	}
}
