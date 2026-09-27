import logo from '../../assets/brand/careergps-logo.jpg';

export function BrandMark({ className = '' }) {
  return (
    <img
      className={className}
      src={logo}
      alt="CareerGPS"
      width="240"
      height="99"
    />
  );
}
