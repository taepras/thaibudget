import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: 16px;
  color: white;
  font-size: 0.75rem;
  flex-grow: 1;
  min-height: 0;
  overflow: hidden;
`;

const Title = styled.h3`
  margin: 0 0 12px 0;
  font-size: 1rem;
  opacity: 0.8;
  word-break: break-word;
  margin-bottom: 0;
`;

const BasicUi = {
  Container,
  Title,
};

export default BasicUi;
