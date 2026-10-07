// Keel mark: the orange and black circle. Square image, transparent corners.
export default function Logo({ size = 28 }: { size?: number }) {
  return (<img src="/keel-mark.png" width={size} height={size} alt="" aria-hidden="true" style={{ display: 'block', borderRadius: '50%' }} />);
}
