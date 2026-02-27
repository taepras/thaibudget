import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: 16px;
  color: white;
  font-size: 12px;
  flex-grow: 1;
`;

const Title = styled.h3`
  margin: 0 0 12px 0;
  font-size: 14px;
  opacity: 0.8;
  word-break: break-word;
  margin-bottom: 0;
`;

const BasicUi = {
  Container,
  Title,
};

export default BasicUi;
