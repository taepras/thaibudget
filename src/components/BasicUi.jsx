import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  padding: 16px;
  color: white;
  font-size: 0.875rem;
  flex-grow: 1;
  min-height: 0;
  overflow: hidden;
`;

const Title = styled.h3`
  margin: 0 0 12px 0;
  font-size: 1rem;
  opacity: 0.6;
  word-break: break-word;
  margin-bottom: 0;
`;

const TextInput = styled.input`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  padding: 6px 10px;
  color: white;
  font-size: 0.875rem;
  font-family: inherit;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.15s, background 0.15s;

  &::placeholder {
    color: rgba(255, 255, 255, 0.35);
  }

  &:focus {
    border-color: rgba(255, 255, 255, 0.5);
    background: rgba(255, 255, 255, 0.15);
  }
`;

const BasicUi = {
  Container,
  Title,
  TextInput,
};

export default BasicUi;
