import {ApplicationRef, Injectable} from '@angular/core';

export const DefaultTheme = {
	'--main-background': '#272727',
	'--background-gd': 'linear-gradient(to right, #232526, #414345)',
	'--background-gd-webkit': '-webkit-linear-gradient(to right, #232526, #414345)',
	'--header-background': '#313131',
	'--header-title-color': '#9a9a9a',
	'--header-icon-color': '#fafafa',
	'--theme-icon-color': '#fafafa',
	'--theme-icon-color-hover': '#c0c0c0',
	'--special-font': 'inherit',
	'--special-font-regular': 'inherit',
	'--special-font-bold': 'inherit',
	'--special-font-italic': 'inherit',
	'--special-font-bolditalic': 'inherit',
	'--slogan-special-color': 'inherit',
	'--dashboard-animation-display': 'block',
	'--dashboard-img-display': 'none',

	'--landing-background': 'url("./assets/fundosimpleos.png")',

	'--sidenav-background': '#191919',
	'--sidenav-color': '#b1b1b1',
	'--sidenav-option-color': '#525a60',
	'--sidenav-active-background': '#272727',
	'--sidenav-active-color': '#e3e3e3',
	'--sidenav-active-border-color1': '#272727',
	'--sidenav-active-border-color2': '#535353',

	'--top-btn-backgorund': '#1f1f1f',
	'--top-btn-color': '#f8f8f8',

	'--mat-tab-active': '#3b3b3b',
	'--mat-tab-bar-active': '#0094d2',
	'--mat-tab-bar-height': '2px',

	'--tokens-panel-background': '#191919',
	'--destaque-color-token': '#0094d2',
	'--token-title-color': '#b1b1b1',
	'--token-price-color': '#696969',
	'--letter-divider': '#3f3f3f',
	'--contact-hover-color': '#b1b1b1',

	'--accordion-hover-background': '#0078a3',
	'--accordion-color': '#cccccc',
	'--accordion-a-color': '#cccccc',

	'--info-card-background': '#333333',
	'--card-hover-backgorund': '#3b3b3b',
	'--expand-background': '#1c1c1c',

	'--text-calendar': '#FFFFFF',
	'--text-disabled-calendar': '#4d4d4d',
	'--scroll-track-background': '#191919',
	'--scroll-background': '#191919',
	'--scroll-thumb-background': '#555555',

	'--table-th-color': '#cccccc',
	'--table-th-background': '#333333',
	'--table-tr-background': 'transparent',
	'--table-tr-color': '#b1b1b1',
	'--table-td-color': '#b1b1b1',

	'--verify-card-text-color': '#f8f8f8',
	'--verify-card-backgound-color': 'rgba(162, 162, 162, 0.12)',

	'--text-title-color': '#a4a4a4',
	'--text-btn-color-hover': '#ffffff',
	'--text-gray-color': '#b1b1b1',
	'--text-gray2-color': '#e9e9e9',
	'--text-gray3-color': '#d6d6d6',
	'--text-white-color': '#ffffff',
	'--text-destaque-color': '#0094d2',
	'--text-blue-color': '#0094d2',
	'--text-error': '#d04d42',
	'--made-with-love': '#a4a4a4',

	'--a-link-color': '#0094d2',

	'--modal-background': '#191919',
	'--modal-color': '#858585',
	'--modal-title-color': '#e3e3e3',
	'--modal-side-title-color': '#e3e3e3',
	'--modal-side-color': '#c2c2c2',
	'--modal-side-background': '#272727',
	'--modal-step-background': '#535353',
	'--modal-step-line-background': '#535353',
	'--modal-step-off-background': '#828181',

	'--tr-even-backgorund': 'transparent',
	'--tr-odd-backgorund': 'transparent',
	'--tr-border-bottom-color': '1px solid #3f3f3f',

	'--tr-resource-even-backgorund': '#2C2C2C',
	'--tr-resource-odd-color': '#ececec',
	'--tr-resource-odd-backgorund': 'transparent',
	'--tr-hover': '#1f1f1f',

	'--rex-balance-title-color': '#b1b1b1',
	'--rex-balance-info-color': '#ffffff',
	'--rex-btn-color': '#0094d2',
	'--rex-border-color': '#0094d2',

	'--btn-border-color': '#0094d2',
	'--btn-color': '#0094d2',
	'--btn-success-color': '#ffffff',
	'--btn-color-hover': '#ffffff',
	'--btn-background-hover': '#0077b7',
	'--btn-rev-color-hover': '#0094d2',

	'--btn-primary-bg': '#0079b8',
	'--btn-primary-hover': '#004d8a',

	'--btn-inverse-color': '#ffffff',
	'--btn-inverse-background-hover': '#0094d2',
	'--btn-inverse-color-hover': '#ffffff',

	'--btn-inverse2-color': '#ffffff',
	'--btn-inverse2-background-hover': '#ffffff',
	'--btn-inverse2-color-hover': '#0094d2',

	'--btn-link2-color': '#0094d2',
	'--btn-link2-background-hover': '#ffffff',
	'--btn-link2-color-hover': '#0077b7',

	'--btn-link-color': '#0094d2',
	'--btn-link-background-hover': '#ffffff',
	'--btn-link-color-hover': '#0077b7',

	'--update-box-background': '#1f1f1f',
	'--chain-icon-bg': '#c5c5c5',
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

	'--landing-background': 'url("./assets/cover-liberland3.png")',

	'--sidenav-background': '#1577C6',
	'--sidenav-color': '#D6D6D6',
	'--sidenav-option-color': '#f8f8f8',
	'--sidenav-active-background': '#EDEDEC',
	'--sidenav-active-color': '#1577C6',
	'--sidenav-active-border-color1': '#EDEDEC',

	'--top-btn-backgorund': '#084577',
	'--top-btn-color': '#f8f8f8',

	'--mat-tab-active': '#084577',
	'--mat-tab-bar-active': '#FCD215',
	'--mat-tab-bar-height': '4px',

	'--tokens-panel-background': '#1577C6',
	'--destaque-color-token': '#FCD215',
	'--token-title-color': '#f8f8f8',
	'--token-price-color': '#D6D6D6',
	'--letter-divider': '#FCD215',
	'--contact-hover-color': '#292929',

	'--accordion-hover-background': '#0078a3',
	'--accordion-color': '#707070',
	'--accordion-a-color': '#707070',
	'--accordion-color-hover': '#404040',

	'--info-card-background': '#F8F8F8',
	'--card-hover-backgorund': '#ececec',
	'--expand-background': '#FAFAFA',

	'--text-calendar': '#404040',
	'--text-disabled-calendar': '#d6d6d6',

	'--scroll-track-background': '#f1f1f1',
	'--scroll-background': '#f1f1f1',
	'--scroll-thumb-background': '#D6D6D6',

	'--table-th-color': '#084577',
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
	'--text-gray3-color': '#b1b1b1',
	'--text-destaque-color': '#FCD215',
	'--text-blue-color': '#1577C6',
	'--text-error': '#ff8880',
	'--made-with-love': '#ffffff',

	'--a-link-color': '#F8F8F8',

	'--modal-background': '#F8F8F8',
	'--modal-color': '#707070',
	'--modal-title-color': '#404040',
	'--modal-side-title-color': '#F8F8F8',
	'--modal-side-color': '#d6d6d6',
	'--modal-side-background': '#1577C6',
	'--modal-step-background': '#084577',
	'--modal-step-line-background': '#084577',
	'--modal-step-off-background': '#ffffff',

	'--tr-even-backgorund': '#ffffff',
	'--tr-odd-backgorund': '#ffffff',
	'--tr-border-bottom-color': '1px solid #cccccc',

	'--tr-resource-even-backgorund': '#1577C6',
	'--tr-resource-odd-color': '#202020',
	'--tr-resource-odd-backgorund': 'transparent',
	'--tr-hover': '#d2d2d2',

	'--rex-balance-title-color': '#cccccc',
	'--rex-balance-info-color': '#f8f8f8',
	'--rex-btn-color': '#ffffff',
	'--rex-border-color': '#ffffff',

	'--btn-border-color': '#084577',
	'--btn-color': '#084577',
	'--btn-success-color': '#303030',
	'--btn-color-hover': '#ffffff',
	'--btn-background-hover': '#084577',
	'--btn-rev-color-hover': '#1577C6',

	'--btn-primary-bg': '#0079b8',
	'--btn-primary-hover': '#004d8a',

	'--btn-inverse-color': '#ffffff',
	'--btn-inverse-background-hover': '#ffffff',
	'--btn-inverse-color-hover': '#084577',

	'--btn-inverse2-color': '#202020',
	'--btn-inverse2-background-hover': '#ffffff',
	'--btn-inverse2-color-hover': '#084577',

	'--btn-link2-color': '#FCD215',
	'--btn-link2-background-hover': '#ffffff',
	'--btn-link2-color-hover': '#ffffff',

	'--btn-link-color': '#1577C6',
	'--btn-link-background-hover': '#ffffff',
	'--btn-link-color-hover': '#084577',

	'--update-box-background': '#0d3352',
	'--chain-icon-bg': '#c5c5c5',
};

export const LightTheme = {
	'--main-background': '#ffffff',
	'--background-gd': 'linear-gradient(to right, #EDEDEC, #F8F8F8)',
	'--background-gd-webkit': '-webkit-linear-gradient(to right, #EDEDEC, #F8F8F8)',
	'--header-background': '#D1D1D1',
	'--header-title-color': '#292929',
	'--header-icon-color': '#20202095',
	'--theme-icon-color': '#20202095',
	'--theme-icon-color-hover': '#292929',
	'--special-font': 'inherit',
	'--special-font-regular': 'inherit',
	'--special-font-bold': 'inherit',
	'--special-font-italic': 'inherit',
	'--special-font-bolditalic': 'inherit',
	'--special-font-weight': 'inherit',
	'--slogan-special-color': '#adadad',

	'--landing-background': 'url("./assets/fundosimpleoslight.png")',
	// '--landing-image-background': 'url("../../assets/fundosimpleoslight.png")',


	'--dashboard-animation-display': 'none',
	'--dashboard-img-display': 'block',

	// '--sidenav-background': '#f8f8f8',
	'--sidenav-background': '#0094d2',
	// '--sidenav-color': '#565656',
	'--sidenav-color': '#dadada',
	// '--sidenav-option-color': '#a5a5a5',
	'--sidenav-option-color': '#f8f8f8',
	'--sidenav-active-background': '#ffffff',
	// '--sidenav-active-color': '#9a9a9a',
	'--sidenav-active-color': '#0094d2',
	// '--sidenav-active-border-color1': '#ffffff',
	'--sidenav-active-border-color1': '#EDEDEC',

	'--top-btn-backgorund': '#afafaf',
	'--top-btn-color': '#f8f8f8',

	'--mat-tab-active': '#afafaf',
	'--mat-tab-bar-active': '#FCD215',
	'--mat-tab-bar-height': '4px',

	'--tokens-panel-background': '#f8f8f8',
	'--destaque-color-token': '#0094d2',
	'--token-title-color': '#000000',
	'--token-price-color': '#707070',
	'--letter-divider': '#afafaf',
	'--contact-hover-color': '#ffffff',

	'--accordion-hover-background': '#bfbfbf',
	'--accordion-color': '#707070',
	'--accordion-a-color': '#707070',
	'--accordion-color-hover': '#404040',

	'--info-card-background': '#F8F8F8',
	'--card-hover-backgorund': '#ececec',
	'--expand-background': '#FAFAFA',

	'--text-calendar': '#404040',
	'--text-disabled-calendar': '#d6d6d6',

	'--scroll-track-background': '#f1f1f1',
	'--scroll-background': '#f1f1f1',
	'--scroll-thumb-background': '#D6D6D6',

	'--table-th-color': '#212121',
	'--table-th-background': '#f8f8f8',
	'--table-tr-background': '#ffffff',
	'--table-tr-color': '#404040',
	'--table-td-color': '#404040',

	'--verify-card-text-color': '#696969',
	'--text-title-color': '#404040',
	'--text-white-color': '#202020',
	'--text-btn-color-hover': '#f8f8f8',
	'--text-gray-color': '#404040',
	'--text-gray2-color': '#707070',
	'--text-gray3-color': '#b1b1b1',
	'--text-destaque-color': '#FCD215',
	'--text-blue-color': '#0094d2',
	'--text-error': '#f44336',
	'--made-with-love': '#404040',

	'--a-link-color': '#FCD215',

	'--modal-background': '#F8F8F8',
	'--modal-color': '#707070',
	'--modal-title-color': '#404040',
	'--modal-side-title-color': '#F8F8F8',
	'--modal-side-color': '#d6d6d6',
	'--modal-side-background': '#0094d2',
	'--modal-step-background': '#afafaf',
	'--modal-step-line-background': '#afafaf',
	'--modal-step-off-background': '#ffffff',

	'--tr-even-backgorund': '#ffffff',
	'--tr-odd-backgorund': '#ffffff',
	'--tr-border-bottom-color': '1px solid #cccccc',
	'--tr-resource-even-backgorund': '#aaaaaa',
	'--tr-resource-odd-color': '#202020',
	'--tr-resource-odd-backgorund': 'transparent',
	'--tr-hover': '#afafaf',

	'--rex-balance-title-color': '#e9e9e9',
	'--rex-balance-info-color': '#f8f8f8',
	'--rex-btn-color': '#ffffff',
	'--rex-border-color': '#ffffff',

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
	'--modal-step-off-background': '#ffffff',
	'--btn-primary-bg': '#c56907',
	'--btn-primary-hover': '#8f4c05',
	'--chain-icon-bg': 'white',
	'--text-error': '#ff8e85',
	'--made-with-love': '#bfbfbf',

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
