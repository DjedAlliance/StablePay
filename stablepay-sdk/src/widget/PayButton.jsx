import React from "react";
import styles from "../styles/main.css";

const PayButton = ({ onClick, size = "medium" }) => {
  const sizeStyles = {
    small: { width: "200px", height: "50px", fontSize: "14px" },
    medium: { width: "250px", height: "60px", fontSize: "16px" },
    large: { width: "300px", height: "70px", fontSize: "18px" },
  };

  const logoSizes = {
    small: { width: "35px", height: "33px" },
    medium: { width: "40px", height: "38px" },
    large: { width: "45px", height: "43px" },
  };

  const buttonStyle = sizeStyles[size] || sizeStyles.medium;
  const logoStyle = logoSizes[size] || logoSizes.medium;

  return (
    <button
      className={styles.stablePayButton}
      onClick={onClick}
      style={buttonStyle}
    >
      <div className={styles.logo} style={logoStyle} />
      <span className={styles.buttonText}>Pay with StablePay</span>
    </button>
  );
};

export default PayButton;
