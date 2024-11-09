import React from 'react';
import styles from '../styles/PricingCard.css';


const Dialog = ({ children, onClose, size = 'medium' }) => {
  return (
    <div className={styles.dialogOverlay}>
      <div className={`${styles.pricingCard} ${styles[size]}`}>
        <button className={styles.dialogClose} onClick={onClose}>×</button>
        <div className={styles.pricingCardHeader}>
        <div className={styles.allianceLogo}></div>

          <h2 className={styles.stablepayTitle}>StablePay</h2>
        </div>
        <div className={styles.pricingCardBody}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default Dialog;