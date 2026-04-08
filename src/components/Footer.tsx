import React from 'react';
import FooterSection from './home/FooterSection';
import { buildFooterContent } from './siteChromeConfig';

export default function Footer() {
  return (
    <FooterSection content={buildFooterContent()} standalone />
  );
}
