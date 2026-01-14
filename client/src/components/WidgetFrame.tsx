import type { ReactNode } from 'react';

export default function WidgetFrame(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="widget">
      <div className="widget__header">
        <div className="widget__title">{props.title}</div>
        {props.subtitle ? <div className="widget__subtitle">{props.subtitle}</div> : null}
      </div>
      <div className="widget__body">{props.children}</div>
    </section>
  );
}
