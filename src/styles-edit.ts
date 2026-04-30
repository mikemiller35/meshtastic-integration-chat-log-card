import { css } from 'lit';

// Styles belonging to the editor view
// https://lit.dev/docs/components/styles/
export default css`
  .card-config {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .box {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .intro {
    margin: 0;
    color: var(--secondary-text-color);
    font-size: 0.85rem;
  }
`;
