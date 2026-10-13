import logo from '../../assets/brand/navigoa-logo.jpg';

export function BrandMark({ className = '' }) {
  return (
    <img
      className={className}
      src={logo}
      alt="NaviGoa — Navigate, Build, Grow"
      width="240"
      height="99"
    />
  );
}
