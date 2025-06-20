use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    pubkey::Pubkey,
};

#[derive(BorshSerialize, BorshDeserialize)]
struct CounterState {
    count: u32,
}

entrypoint!(process_instruction);

fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    _instruction_data: &[u8],
) -> ProgramResult {
    let mut iter = accounts.iter(); // Get iterator for accounts
    let data_account = next_account_info(&mut iter)?; // Extract the data account from accounts
    if !data_account.is_signer {
        return ProgramResult::Err(
            solana_program::program_error::ProgramError::MissingRequiredSignature,
        );
    }

    let mut counter_state = CounterState::try_from_slice(&mut *data_account.data.borrow_mut())?; // Deserialize counter state from account data
    if counter_state.count == 0 {
        counter_state.count = 1;
    } else {
        counter_state.count = counter_state.count * 2;
    }
    counter_state.serialize(&mut *data_account.data.borrow_mut())?; // Save updated state back to account

    Ok(())
}
