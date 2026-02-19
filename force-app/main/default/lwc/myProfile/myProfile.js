import { LightningElement, wire } from 'lwc';
import getUserDetails from '@salesforce/apex/UserProfileController.getUserDetails';

export default class MyProfile extends LightningElement {

    user;
    account;
    accountType = '';
    isLoaded = false;

    get displayAccountType() {
        return this.accountType && this.accountType.trim() ? this.accountType : 'N/A';
    }

    get cardTitle() {
        return `My Profile - AccountType loaded: ${this.displayAccountType}`;
    }

    @wire(getUserDetails)
    wiredUser({ error, data }) {
        if (data) {
            this.user = data.user;
            this.account = data.account;
            this.accountType = data.accountType || '';
            this.isLoaded = true;
            
            console.log('=== getUserDetails Response ===');
            console.log('User:', data.user);
            console.log('Account:', data.account);
            console.log('AccountType loaded:', this.accountType);
            console.log('Full data object:', data);
        } else if (error) {
            console.error('Error in getUserDetails:', error);
        }
    }
}
