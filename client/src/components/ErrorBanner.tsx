export default function ErrorBanner(props: { message: string }) {
  return (
    <div className="errorBanner">
      <strong>Data error:</strong> {props.message}
    </div>
  );
}
