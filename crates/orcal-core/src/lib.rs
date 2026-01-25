use thiserror::Error;

#[derive(Debug, Error)]
pub enum ParseError {
    #[error("empty expression")]
    EmptyInput,
    #[error("invalid token: {0}")]
    InvalidToken(char),
    #[error("incomplete expression")]
    UnexpectedEnd,
    #[error("unexpected trailing input")]
    UnexpectedTrailingInput,
    #[error("division by zero")]
    DivisionByZero,
}

struct Parser<'a> {
    input: &'a str,
    pos: usize,
}

impl<'a> Parser<'a> {
    fn new(input: &'a str) -> Self {
        Self { input, pos: 0 }
    }

    fn parse(mut self) -> Result<f64, ParseError> {
        self.skip_whitespace();
        if self.is_eof() {
            return Err(ParseError::EmptyInput);
        }
        let value = self.parse_expression()?;
        self.skip_whitespace();
        if self.is_eof() {
            Ok(value)
        } else {
            Err(ParseError::UnexpectedTrailingInput)
        }
    }

    fn parse_expression(&mut self) -> Result<f64, ParseError> {
        let mut value = self.parse_term()?;
        loop {
            self.skip_whitespace();
            match self.peek_char() {
                Some('+') => {
                    self.advance_char();
                    value += self.parse_term()?;
                }
                Some('-') => {
                    self.advance_char();
                    value -= self.parse_term()?;
                }
                _ => break,
            }
        }
        Ok(value)
    }

    fn parse_term(&mut self) -> Result<f64, ParseError> {
        let mut value = self.parse_factor()?;
        loop {
            self.skip_whitespace();
            match self.peek_char() {
                Some('*') => {
                    self.advance_char();
                    value *= self.parse_factor()?;
                }
                Some('/') => {
                    self.advance_char();
                    let divisor = self.parse_factor()?;
                    if divisor == 0.0 {
                        return Err(ParseError::DivisionByZero);
                    }
                    value /= divisor;
                }
                _ => break,
            }
        }
        Ok(value)
    }

    fn parse_factor(&mut self) -> Result<f64, ParseError> {
        self.skip_whitespace();
        match self.peek_char() {
            Some('(') => {
                self.advance_char();
                let value = self.parse_expression()?;
                self.skip_whitespace();
                if self.peek_char() == Some(')') {
                    self.advance_char();
                    Ok(value)
                } else {
                    Err(ParseError::UnexpectedEnd)
                }
            }
            Some('-') => {
                self.advance_char();
                Ok(-self.parse_factor()?)
            }
            Some(ch) if ch.is_ascii_digit() || ch == '.' => self.parse_number(),
            Some(ch) => Err(ParseError::InvalidToken(ch)),
            None => Err(ParseError::UnexpectedEnd),
        }
    }

    fn parse_number(&mut self) -> Result<f64, ParseError> {
        let start = self.pos;
        let mut seen_dot = false;
        while let Some(ch) = self.peek_char() {
            if ch.is_ascii_digit() {
                self.advance_char();
            } else if ch == '.' && !seen_dot {
                seen_dot = true;
                self.advance_char();
            } else {
                break;
            }
        }
        let slice = &self.input[start..self.pos];
        slice.parse::<f64>().map_err(|_| ParseError::UnexpectedEnd)
    }

    fn skip_whitespace(&mut self) {
        while let Some(ch) = self.peek_char() {
            if ch.is_whitespace() {
                self.advance_char();
            } else {
                break;
            }
        }
    }

    fn peek_char(&self) -> Option<char> {
        self.input[self.pos..].chars().next()
    }

    fn advance_char(&mut self) {
        if let Some(ch) = self.peek_char() {
            self.pos += ch.len_utf8();
        }
    }

    fn is_eof(&self) -> bool {
        self.pos >= self.input.len()
    }
}

pub fn evaluate(expression: &str) -> Result<f64, ParseError> {
    Parser::new(expression).parse()
}

pub fn format_result(value: f64) -> String {
    if value == 0.0 {
        return "0".to_string();
    }
    let mut text = format!("{value}");
    if text.contains('.') {
        while text.ends_with('0') {
            text.pop();
        }
        if text.ends_with('.') {
            text.pop();
        }
    }
    text
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn evaluates_expressions() {
        let value = evaluate("12 * (3 + 8)").expect("valid expression");
        assert_eq!(value, 132.0);
    }

    #[test]
    fn formats_trimmed_result() {
        assert_eq!(format_result(42.0), "42");
        assert_eq!(format_result(3.1400), "3.14");
    }
}
