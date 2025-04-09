// src/components/Footer.js
import React from "react";
import "./Footer.css";
import {
  FaTwitter,
  FaDiscord,
  FaLinkedinIn,
} from "react-icons/fa";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-content">
        <p>
          Copyright © {new Date().getFullYear()} Whatalab. All Right Reserved.
        </p>
        <div className="social-icons">
          <a
            className="glassIco"
            href="https://x.com/whatalab_"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Twitter"
          >
            <FaTwitter />
          </a>
          <a
            className="glassIco"
            href="https://discord.gg/EfRqH5A9Ae"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Discord"
          >
            <FaDiscord />
          </a>
          {/*<a className="glassIco" href="https://facebook.com/tu_cuenta" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
            <FaFacebookF />
          </a>*/}
          {/*<a className="glassIco" href="https://instagram.com/tu_cuenta" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <FaInstagram />
          </a>*/}
          <a
            className="glassIco"
            href="https://linkedin.com/in/solmo"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
          >
            <FaLinkedinIn />
          </a>
          {/*<a className="glassIco" href="https://wa.me/tu_numero" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
            <FaWhatsapp />
          </a>*/}
        </div>
      </div>
    </footer>
  );
}

export default Footer;
